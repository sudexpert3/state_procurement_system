import datetime

import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.permissions import AllowAny

from django.db.models import Prefetch

from ..serializers import ContractSerializer
from ..models import Contract, ContractItem
from ..permissions import has_capability
from ..services import get_current_date


class ContractFilter(django_filters.FilterSet):
    # Обратной связи Contract -> PlanItem нет как поля модели (только через
    # items.plan_share.budget_cost.plan_item) — именованный фильтр нужен, чтобы
    # фронтенд мог запросить договоры конкретного пункта плана без вытягивания
    # всего реестра договоров и фильтрации на клиенте.
    plan_item = django_filters.NumberFilter(
        field_name='items__plan_share__budget_cost__plan_item',
        label='ID пункта плана (PlanItem)',
    )
    # Запрос фронтенда (правка 2026-11-17, CurrentStatus.md): была хотя бы одна
    # оплата по договору или нет. У Contract нет своего поля-признака — это
    # Exists-проверка по обратной связи treasury_payments.
    has_payments = django_filters.BooleanFilter(
        method='filter_has_payments', label='Есть хотя бы одна оплата',
    )
    # Запрос пользователя (2026-11-18): найти договоры, у которых срок исполнения
    # (planned_delivery_date) скоро истекает — N дней на выбор фронтенда, а не жёстко
    # зашитые 5 дней из Contract.is_urgent_warning (тот порог — для "критического"
    # значка в колонке, это отдельный, более узкий случай). Уже просроченные
    # (planned_delivery_date < сегодня) сюда не попадают — это "просрочено", а не
    # "скоро истекает".
    expiring_within_days = django_filters.NumberFilter(
        method='filter_expiring_within_days',
        label='Срок исполнения истекает в течение N дней (включая сегодня)',
    )
    # Запрос фронтенда (CurrentStatus.md, 2026-11-21, следом за тем же фильтром у
    # /api/plan_items/): подразделение договора определяется через спецификацию
    # (ContractItem.plan_share.department) — у одного договора может быть несколько
    # строк спецификации с разными подразделениями, поэтому ищем "хотя бы одна".
    department = django_filters.NumberFilter(
        field_name='items__plan_share__department',
        label='ID подразделения (через спецификацию договора)',
    )

    class Meta:
        model = Contract
        fields = ['supplier', 'plan_item', 'has_payments', 'expiring_within_days', 'department']

    def filter_has_payments(self, queryset, name, value):
        if value:
            return queryset.filter(treasury_payments__isnull=False)
        return queryset.filter(treasury_payments__isnull=True)

    def filter_expiring_within_days(self, queryset, name, value):
        today = get_current_date()
        return queryset.filter(
            planned_delivery_date__gte=today,
            planned_delivery_date__lte=today + datetime.timedelta(days=int(value)),
        )


class ContractViewSet(viewsets.ModelViewSet):
    """Эндпоинт управления и казначейского контроля реестра договоров ГКСЭ"""
    queryset = Contract.objects.all().prefetch_related(
        # select_related вглубь plan_share — иначе ContractItemSerializer.department_detail/
        # economic_class_detail/internal_economic_class_detail (запрос фронтенда 2026-11-18)
        # дадут N+1 запросов на каждую строку спецификации каждого договора.
        Prefetch('items', queryset=ContractItem.objects.select_related(
            'plan_share__department', 'plan_share__budget_cost__economic_class',
            'plan_share__budget_cost__internal_economic_class',
        )),
        'treasury_payments', 'quarterly_finances',
    ).select_related('supplier', 'procurement_method_detail').distinct()
    serializer_class = ContractSerializer
    # Чтение — временный отладочный режим системы (AllowAny для всех ролей, как и раньше).
    # Запись (создание/правка/удаление) — запрос пользователя (2026-11-18): только
    # «Главный администратор» и «Финансист» (см. procurement/permissions.py, CAPABILITIES).
    permission_classes = [AllowAny]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [has_capability('edit_contracts')()]
        return [AllowAny()]

    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = ContractFilter
    # Запрос фронтенда (правка 2026-11-17): текстовый поиск по наименованию
    # (ContractItem.title — у самого Contract нет поля "наименование"), номеру
    # договора и поставщику — строка поиска в разделе "Договоры".
    search_fields = ['number', 'supplier__name', 'items__title']
