from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from ..models.treasuryPayment import TreasuryPayment
from ..serializers.payment import TreasuryPaymentSerializer


class TreasuryPaymentViewSet(viewsets.ModelViewSet):
    """Эндпоинт для регистрации фактических оплат по договорам"""
    queryset = TreasuryPayment.objects.all()
    serializer_class = TreasuryPaymentSerializer
    permission_classes = [AllowAny]  # Временный режим отладки системы
    filterset_fields = ['contract']
