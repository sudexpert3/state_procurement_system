from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from ..models import TreasuryPayment
from ..serializers import TreasuryPaymentSerializer


class TreasuryPaymentViewSet(viewsets.ModelViewSet):
    """Эндпоинт для регистрации фактических оплат — как по договорам, так и
    "свободных" платёжек, относящихся на статью расходов напрямую (Этап 4.1)"""
    queryset = TreasuryPayment.objects.all().prefetch_related('departments').select_related(
        'contract', 'kind', 'internal_economic_class', 'economic_class', 'functional_class', 'program_class',
    )
    serializer_class = TreasuryPaymentSerializer
    permission_classes = [AllowAny]  # Временный режим отладки системы
    filterset_fields = ['contract', 'payment_year', 'quarter', 'kind', 'departments']
