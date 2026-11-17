import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.permissions import AllowAny

from ..serializers import ContractSerializer
from ..models import Contract


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

    class Meta:
        model = Contract
        fields = ['supplier', 'plan_item', 'has_payments']

    def filter_has_payments(self, queryset, name, value):
        if value:
            return queryset.filter(treasury_payments__isnull=False)
        return queryset.filter(treasury_payments__isnull=True)


class ContractViewSet(viewsets.ModelViewSet):
    """Эндпоинт управления и казначейского контроля реестра договоров ГКСЭ"""
    queryset = Contract.objects.all().prefetch_related(
        'items', 'treasury_payments', 'quarterly_finances',
    ).select_related('supplier', 'procurement_method_detail').distinct()
    serializer_class = ContractSerializer
    permission_classes = [AllowAny]  # Временный отладочный режим системы
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = ContractFilter
    # Запрос фронтенда (правка 2026-11-17): текстовый поиск по наименованию
    # (ContractItem.title — у самого Contract нет поля "наименование"), номеру
    # договора и поставщику — строка поиска в разделе "Договоры".
    search_fields = ['number', 'supplier__name', 'items__title']
