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
    # Выводим только актуальные коды, сортируя по алфавиту для удобства плановиков
    queryset = UnitOfMeasurement.objects.filter(is_active=True)
    serializer_class = UnitOfMeasurementSerializer
    permission_classes = [AllowAny]  # Временный отладочный режим системы
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    pagination_class = None

    # Сквозной поиск: фронтенд сможет искать единицу как по буквам (шт), так и по цифровому коду (0642)
    search_fields = ['code', 'short_name']
    filterset_fields = ['code']