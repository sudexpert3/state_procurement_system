from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from ..models import TreasuryPayment
from ..serializers import BudgetCostsImportSerializer


class TreasuryPaymentViewSet(viewsets.ModelViewSet):
    """Эндпоинт для регистрации фактических оплат по договорам"""
    queryset = TreasuryPayment.objects.all()
    serializer_class = BudgetCostsImportSerializer
    permission_classes = [AllowAny]  # Временный режим отладки системы
    filterset_fields = ['contract']
 