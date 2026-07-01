from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.permissions import AllowAny

from procurement.models import Buyer
from procurement.serializers import BuyerSerializer


class BuyerViewSet(viewsets.ModelViewSet):
    """Эндпоинт вывода списка ответственных работников-закупщиков"""
    queryset = Buyer.objects.all()
    serializer_class = BuyerSerializer
    permission_classes = [AllowAny]  # Временный режим отладки системы
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    pagination_class = None
    search_fields = ['shot_name', 'full_name', ]
    filterset_fields = ['is_active']

    def get_queryset(self):
        queryset = super().get_queryset()

        if 'is_active' not in self.request.query_params:
            return queryset.filter(is_active=True)

        return queryset
