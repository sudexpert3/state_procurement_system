from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from procurement.models import KindOfPayment
from procurement.serializers import KindOfPaymentSerializer


class KindOfPaymentViewSet(viewsets.ModelViewSet):
    """Справочник видов платежей — нужен фронту для select'а при создании TreasuryPayment
    (до этого эндпоинта не было вовсе, см. doc/frontend_handoff.md, раздел 4.1)."""
    queryset = KindOfPayment.objects.all()
    serializer_class = KindOfPaymentSerializer
    permission_classes = [AllowAny]  # Временный режим отладки системы
    pagination_class = None
