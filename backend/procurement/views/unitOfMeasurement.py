from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend

from procurement.models import UnitOfMeasurement
from procurement.serializers import UnitOfMeasurementSerializer


class UnitOfMeasurementViewSet(viewsets.ModelViewSet):
    """
    Эндпоинт ведомственного справочника единиц измерения ОКРБ 008-95.
    Оптимизирован для быстрых выпадающих списков и автокомплитов на фронтенде.
    """
    queryset = UnitOfMeasurement.objects.all()
    serializer_class = UnitOfMeasurementSerializer
    permission_classes = [AllowAny]  # Временный отладочный режим системы
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    pagination_class = None
    search_fields = ['code', 'short_name']
    filterset_fields = ['code', 'is_active']

    def get_queryset(self):
        queryset = super().get_queryset()

        if 'is_active' not in self.request.query_params:
            return queryset.filter(is_active=True)

        return queryset