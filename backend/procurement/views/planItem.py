from django.db import models
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny

from core.choices import PlanItemStatus
from procurement.models import Purchases, PlanItem, PlanItemDetail, BudgetCosts, ContractItem
from procurement.serializers import PlanItemSerializer, PlanItemShortSerializer, PlanItemFullSerializer


def _parse_id(raw_value):
    """int(float(x)) вместо int(x) — ?buyer=5.0 (не наш случай, но на всякий) не упадёт,
    а нечисловое значение (например "NaN", "undefined") трактуется как "параметр не
    задан", а не как 500 от ORM на FK-лукапе."""
    if raw_value is None or str(raw_value).strip() == '':
        return None
    try:
        return int(float(raw_value))
    except (TypeError, ValueError):
        return None


class PlanItemViewSet(viewsets.ModelViewSet):
    """
    Эндпоинт управления неизменяемыми мастер-записями позиций годового плана ГПЗ.
    Обеспечивает сквозной оперативный контроль лимитов и кассового исполнения обязательств.
    """
    permission_classes = [AllowAny]  # Временный режим отладки системы
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['num', 'details__title', 'details__okrb']
    # filterset_fields = ['is_public', 'plan_purchase', 'plan_purchase__year']

    def get_queryset(self):
        """Оптимизируем SQL-запросы в зависимости от действия.

        2026-11-06: фронт пожаловался на медленный `/api/plan_items/` (~2.3с даже на
        странице из 20 строк, ~9с на весь год) — профилирование показало классический
        N+1: `PlanItemShortSerializer.get_economic_details()`/`get_contracts()` игнорировали
        уже подготовленный здесь префетч и переспрашивали БД на КАЖДУЮ позицию плана, а
        `BudgetCostsForShortItemSerializer` внутри них — ещё по 2-3 запроса на КАЖДУЮ строку
        бюджета (plan_item, его details, internal_economic_class). См. подробный разбор и
        итоговые цифры в CurrentStatus.md, Этап 4.6. Здесь — подготовка под фикс в
        сериализаторе: select_related на вложенный ЭКР-код внутри префетча budget_costs
        (чтобы BudgetCostsForShortItemSerializer.internal_economic_class_detail не делал
        отдельный запрос на каждую строку) и annotate has_contracts одним SQL-подзапросом
        на весь список сразу (вместо отдельного .exists() на каждую позицию в get_contracts).
        """
        def with_default_budget_prefetch(qs):
            """Префетч ВСЕХ активных строк бюджета позиции (без срезки по коду статьи) —
            действие по умолчанию, когда фильтр по коду ЭКР не задан."""
            return qs.prefetch_related(
                models.Prefetch(
                    'budget_costs',
                    queryset=BudgetCosts.objects.filter(status=PlanItemStatus.ACTIVE).select_related(
                        'internal_economic_class', 'functional_class', 'economic_class',
                    ),
                    to_attr='active_budget_costs_prefetched',
                )
            )

        queryset = PlanItem.objects.prefetch_related(
            models.Prefetch(
                'details',
                queryset=PlanItemDetail.objects.filter(status=PlanItemStatus.ACTIVE),
                to_attr='active_plan_item_detail_prefetched'
            ),
        ).annotate(
            has_contracts=models.Exists(
                ContractItem.objects.filter(
                    plan_share__status=PlanItemStatus.ACTIVE,
                    plan_share__budget_cost__status=PlanItemStatus.ACTIVE,
                    plan_share__budget_cost__plan_item=models.OuterRef('pk'),
                )
            ),
            # Запрос фронтенда (frontend_handoff.md, раздел 9.1, 2026-11-05): число
            # уникальных договоров вместо просто "есть/нет" (у одной позиции может быть
            # несколько ContractItem на один Contract — разные подразделения/строки одного
            # договора, см. CurrentStatus.md пример 2026-102377498-66, 14 договоров). Считаем
            # через коррелированный подзапрос с GROUP BY + COUNT(DISTINCT contract) — обычный
            # annotate(Count(..., distinct=True)) вместе с другими join'ами в этом же queryset
            # (напр. SearchFilter по details__title/details__okrb) рисковал бы задвоить счёт
            # из-за fan-out по нескольким join'ам; подзапрос полностью изолирован от основного
            # запроса, как и has_contracts выше (тот же приём, Exists вместо join-фильтра).
            contracts_count=Coalesce(
                models.Subquery(
                    ContractItem.objects.filter(
                        plan_share__status=PlanItemStatus.ACTIVE,
                        plan_share__budget_cost__status=PlanItemStatus.ACTIVE,
                        plan_share__budget_cost__plan_item=models.OuterRef('pk'),
                    ).order_by().values('plan_share__budget_cost__plan_item').annotate(
                        count=models.Count('contract', distinct=True)
                    ).values('count'),
                    output_field=models.IntegerField(),
                ),
                0,
            ),
        )

        if not self.request:
            return with_default_budget_prefetch(queryset).all()

        if self.action == 'list':
            params = self.request.query_params

            purchase_id = params.get('purchase', None)

            if purchase_id:
                try:
                    purchase_id = int(str(purchase_id).strip())
                except (ValueError, TypeError):
                    return PlanItem.objects.none()
            else:
                latest_purchase = Purchases.objects.order_by('-id').first()
                if latest_purchase:
                    purchase_id = latest_purchase.id
                else:
                    return PlanItem.objects.none()

            queryset = queryset.filter(plan_purchase_id=purchase_id)

            # Запрос пользователя (CurrentStatus.md, 2026-11-24): селект категорий пунктов
            # плана для реестра закупок — "все/активная/публикуемая/не публикуемая/
            # исключена", по умолчанию "активная" (= is_active=True независимо от is_public,
            # тот же смысл, что раньше был у дефолта старого булевого `is_active`, который
            # этот параметр заменяет собой; `is_active` оставлен ниже для обратной
            # совместимости, если его где-то уже дёргают вручную — curl/скрипты).
            status_category = params.get('status_category', None)
            if status_category:
                status_category = status_category.strip().lower()
                if status_category == 'public':
                    queryset = queryset.filter(is_active=True, is_public=True)
                elif status_category == 'non_public':
                    queryset = queryset.filter(is_active=True, is_public=False)
                elif status_category == 'excluded':
                    queryset = queryset.filter(is_active=False)
                elif status_category == 'all':
                    pass
                else:  # 'active' и любое нераспознанное значение — безопасный дефолт
                    queryset = queryset.filter(is_active=True)
            elif params.get('is_active', 'true').strip().lower() == 'false':
                pass  # старый параметр: is_active=false — без фильтра (эквивалент 'all')
            else:
                queryset = queryset.filter(is_active=True)  # старый дефолт и дефолт нового параметра совпадают

            # Фильтры по кодам ЭКР запрошены фронтендом для реестра закупок —
            # бьём по активным BudgetCosts позиции (несколько строк бюджета на
            # разные года/статьи у одной позиции — обычный случай).
            functional_code = params.get('functional_code', None)
            economic_code = params.get('economic_code', None)
            internal_economic_code = params.get('internal_economic_code', None)

            budget_costs_conditions = {'status': PlanItemStatus.ACTIVE}
            if functional_code:
                # 2026-11-26: было `functional_code=...` — денормализованная строка "как
                # пришло с goszakupki.by", заполняется ТОЛЬКО синхронизацией с порталом
                # (BudgetCostsImportSerializer). У строк бюджета, созданных иначе
                # (внутренний реестр "2026-INTERNAL-...", import_reestr26.py), эта строка
                # всегда NULL, хотя каноническая FK `functional_class` заполнена — такие
                # позиции никогда не попадали под фильтр, даже когда реально относятся к
                # выбранному коду (тот же баг, что и в отображении, см.
                # BudgetCostsForShortItemSerializer). Фильтр по FK (`code_api` — то же
                # значение, что отдаёт `/api/functional_code/`, источник значений для
                # самого select'а на фронте) покрывает оба случая.
                budget_costs_conditions['functional_class__code_api'] = functional_code
            if economic_code:
                budget_costs_conditions['economic_class__code_api'] = economic_code
            if internal_economic_code:
                budget_costs_conditions['internal_economic_class__code'] = internal_economic_code

            has_article_filter = bool(functional_code or economic_code or internal_economic_code)

            # Правка 2026-11-17 (CurrentStatus.md): отображение позиции (aggregated_cost/
            # economic_details) должно оставаться ПОЛНЫМ и объективным независимо от
            # фильтра — пользователь явно попросил вернуть это после предыдущего фикса
            # (тот по ошибке урезал и отображение, а не только футер). Фильтр по коду ЭКР
            # теперь влияет только на: (1) какие позиции попадают в список — через
            # .filter() ниже, и (2) отдельные поля matched_cost/matched_details — только
            # под них префетч режется по фильтру, для футера реестра (сумма внизу должна
            # соответствовать активному фильтру, см. PlanItemShortSerializer).
            queryset = with_default_budget_prefetch(queryset)
            queryset = queryset.prefetch_related(
                models.Prefetch(
                    'budget_costs',
                    queryset=BudgetCosts.objects.filter(**budget_costs_conditions).select_related(
                        'internal_economic_class', 'functional_class', 'economic_class',
                    ),
                    to_attr='matched_budget_costs_prefetched',
                )
            )

            if has_article_filter:
                # Один .filter(**...) — один JOIN, одна и та же строка бюджета должна
                # подходить под все активные условия сразу (а не "функц.код в одной
                # строке, экон.код — в другой").
                plan_item_conditions = {
                    f'budget_costs__{field}': value
                    for field, value in budget_costs_conditions.items()
                }
                queryset = queryset.filter(**plan_item_conditions).distinct()

            # Запрос фронтенда (правка 2026-11-17, CurrentStatus.md): фильтр "исполнитель
            # не определён" для реестра закупок — позиции, у которых в активной
            # PlanItemDetail не проставлен buyer. Отдельное отношение ('details', а не
            # 'budget_costs') — свой JOIN, distinct() нужен независимо от фильтров выше.
            buyer_unset = params.get('buyer_unset', None)
            if buyer_unset and buyer_unset.strip().lower() in ('true', '1'):
                queryset = queryset.filter(
                    details__status=PlanItemStatus.ACTIVE, details__buyer__isnull=True,
                ).distinct()

            # Запрос фронтенда (CurrentStatus.md, 2026-11-21): конкретный исполнитель —
            # select вместо чекбокса "не определён" (который остаётся через buyer_unset
            # выше). Тот же JOIN ('details'), что и у buyer_unset.
            #
            # 2026-11-24: оба параметра (buyer/department) раньше шли в .filter(...=value)
            # как есть — фронт иногда присылает не число (напр. "NaN", когда Select
            # временно без валидного значения), ORM лезет в int(value) на FK-лукапе и
            # падает НЕОБРАБОТАННЫМ 500 (см. CurrentStatus.md, разбор django_errors.log).
            # _parse_id трактует нечисловое значение как "фильтр не задан", а не как
            # ошибку — тот же эффект, что и при отсутствующем параметре.
            buyer_id = _parse_id(params.get('buyer', None))
            if buyer_id is not None:
                queryset = queryset.filter(
                    details__status=PlanItemStatus.ACTIVE, details__buyer_id=buyer_id,
                ).distinct()

            # Запрос фронтенда (CurrentStatus.md, 2026-11-21): подразделение, для которого
            # проводится закупка — позиция распределена на несколько подразделений через
            # PlanShare (одна или несколько активных BudgetCosts), должна находиться по
            # любому из них. Отдельный JOIN от фильтров по кодам ЭКР выше — свой distinct().
            department_id = _parse_id(params.get('department', None))
            if department_id is not None:
                queryset = queryset.filter(
                    budget_costs__status=PlanItemStatus.ACTIVE,
                    budget_costs__plan_shares__status=PlanItemStatus.ACTIVE,
                    budget_costs__plan_shares__department_id=department_id,
                ).distinct()

            # Запрос пользователя (2026-11-26): фильтр реестра закупок — позиции, у которых
            # в Сведения о финансировании ЕСТЬ хотя бы одна активная строка бюджета
            # (BudgetCosts), но НИ У ОДНОЙ из них не добавлено распределение по
            # подразделениям (PlanShare) — "Сведения о финансировании подразделений" внутри
            # карточки позиции пустые. `.filter(budget_costs__status=ACTIVE)` — позиция
            # ИМЕЕТ финансирование (иначе нет смысла говорить о "недобавленном"
            # распределении); отдельный `.exclude(...)` — а НИ У ОДНОЙ из её активных строк
            # бюджета нет активного PlanShare. `filter()` и `exclude()` — РАЗНЫЕ JOIN'ы
            # (стандартная семантика Django для цепочки filter+exclude по relation-полям),
            # поэтому это не "хотя бы одна строка без доли", а именно "НИ У ОДНОЙ строки нет
            # ни одной доли" — то, что нужно по смыслу запроса.
            plan_shares_unset = params.get('plan_shares_unset', None)
            if plan_shares_unset and plan_shares_unset.strip().lower() in ('true', '1'):
                queryset = queryset.filter(budget_costs__status=PlanItemStatus.ACTIVE).exclude(
                    budget_costs__plan_shares__status=PlanItemStatus.ACTIVE,
                ).distinct()

            return queryset

        if self.action == 'retrieve':
            return PlanItem.objects.prefetch_related('details', 'budget_costs')

        return with_default_budget_prefetch(queryset).all()

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PlanItemSerializer

        if self.action == 'list':
            return PlanItemShortSerializer

        return PlanItemFullSerializer

    def paginate_queryset(self, queryset):
        """
        Бизнес-логика UI ГКСЭ: при каскадном выборе позиций внутри формы создания договора
        пагинация отключается параметром ?no_page=true.
        """
        if 'no_page' in self.request.query_params:
            return None
        return super().paginate_queryset(queryset)
