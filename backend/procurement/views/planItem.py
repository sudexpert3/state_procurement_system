from django.db import models
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny

from core.choices import PlanItemStatus
from procurement.models import Purchases, PlanItem, PlanItemDetail, BudgetCosts, ContractItem
from procurement.serializers import PlanItemSerializer, PlanItemShortSerializer, PlanItemFullSerializer


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
        queryset = PlanItem.objects.prefetch_related(
            models.Prefetch(
                'details',
                queryset=PlanItemDetail.objects.filter(status=PlanItemStatus.ACTIVE),
                to_attr='active_plan_item_detail_prefetched'
            ),
            models.Prefetch(
                'budget_costs',
                queryset=BudgetCosts.objects.filter(status=PlanItemStatus.ACTIVE).select_related(
                    'internal_economic_class'
                ),
                to_attr='active_budget_costs_prefetched'
            )
        ).annotate(
            has_contracts=models.Exists(
                ContractItem.objects.filter(
                    plan_share__status=PlanItemStatus.ACTIVE,
                    plan_share__budget_cost__status=PlanItemStatus.ACTIVE,
                    plan_share__budget_cost__plan_item=models.OuterRef('pk'),
                )
            )
        )

        if not self.request:
            return queryset.all()

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

            if params.get('is_active', 'true').strip().lower() == 'false':
                queryset = queryset.filter(plan_purchase_id=purchase_id)
            else:
                queryset = queryset.filter(plan_purchase_id=purchase_id, is_active=True)

            # Фильтры по кодам ЭКР запрошены фронтендом для реестра закупок —
            # бьём по активным BudgetCosts позиции (несколько строк бюджета на
            # разные года/статьи у одной позиции — обычный случай), distinct()
            # на PlanItem, чтобы совпадение по нескольким строкам не плодило дубли.
            functional_code = params.get('functional_code', None)
            if functional_code:
                queryset = queryset.filter(
                    budget_costs__status=PlanItemStatus.ACTIVE,
                    budget_costs__functional_code=functional_code,
                )

            economic_code = params.get('economic_code', None)
            if economic_code:
                queryset = queryset.filter(
                    budget_costs__status=PlanItemStatus.ACTIVE,
                    budget_costs__economic_code=economic_code,
                )

            internal_economic_code = params.get('internal_economic_code', None)
            if internal_economic_code:
                queryset = queryset.filter(
                    budget_costs__status=PlanItemStatus.ACTIVE,
                    budget_costs__internal_economic_class__code=internal_economic_code,
                )

            if functional_code or economic_code or internal_economic_code:
                queryset = queryset.distinct()

            return queryset

        if self.action == 'retrieve':
            return PlanItem.objects.prefetch_related('details', 'budget_costs')

        return queryset.all()

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
