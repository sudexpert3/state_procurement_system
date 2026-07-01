from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from procurement.models import Purchases
from procurement.serializers import PurchasesSerializer


class PurchasesViewSet(viewsets.ModelViewSet):
    """
    Эндпоинт ведомственного ведения годовых планов (Purchases) ГКСЭ.
    Обеспечивает шлюзование пакетов с goszakupki.by и контроль признаков черновиков.
    """
    queryset = Purchases.objects.all()
    serializer_class = PurchasesSerializer
    permission_classes = [AllowAny]  # Временный режим локальной отладки системы без авторизации
    pagination_class = None
    filter_backends = [DjangoFilterBackend]
    search_fields = ['purchase_id', 'year',]
    filterset_fields = ['purchase_id', 'year', 'is_draft',]

