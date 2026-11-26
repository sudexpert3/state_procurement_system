import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.permissions import AllowAny
from ..models import TreasuryPayment
from ..serializers import TreasuryPaymentSerializer


class TreasuryPaymentFilter(django_filters.FilterSet):
    # Запрос фронтенда (2026-11-18): фильтр по произвольному периоду дат платежа —
    # существующие payment_year/quarter дают только грубый период (целый квартал).
    payment_date_after = django_filters.DateFilter(
        field_name='payment_date', lookup_expr='gte', label='Дата платежа с (включительно)',
    )
    payment_date_before = django_filters.DateFilter(
        field_name='payment_date', lookup_expr='lte', label='Дата платежа по (включительно)',
    )

    class Meta:
        model = TreasuryPayment
        # Запрос пользователя (2026-11-26): фильтры по статье ЭКР (economic_class), параграфу
        # (functional_class) и внутреннему коду ЭКР (internal_economic_class) — страница
        # «Платежи» (`departments` уже был, добавлены оставшиеся три по той же модели, точное
        # совпадение по id через авто-генерируемый django-filter `ModelChoiceFilter`).
        fields = [
            'contract', 'payment_year', 'quarter', 'kind', 'departments',
            'economic_class', 'functional_class', 'internal_economic_class',
            'payment_date_after', 'payment_date_before',
        ]


class TreasuryPaymentViewSet(viewsets.ModelViewSet):
    """Эндпоинт для регистрации фактических оплат — как по договорам, так и
    "свободных" платёжек, относящихся на статью расходов напрямую (Этап 4.1)"""
    queryset = TreasuryPayment.objects.all().prefetch_related('departments').select_related(
        'contract', 'kind', 'internal_economic_class', 'economic_class', 'functional_class', 'program_class',
    )
    serializer_class = TreasuryPaymentSerializer
    permission_classes = [AllowAny]  # Временный режим отладки системы
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = TreasuryPaymentFilter
    # Запрос фронтенда (2026-11-18): поиск по примечанию — по аналогии с /api/contracts/.
    search_fields = ['notice']
