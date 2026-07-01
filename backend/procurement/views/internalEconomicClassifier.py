from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend

from procurement.models import InternalEconomicClassifier
from procurement.serializers import InternalEconomicClassifierSerializer, InternalEconomicClassifierTreeSerializer


class InternalEconomicClassifierViewSet(viewsets.ModelViewSet):
    queryset = InternalEconomicClassifier.objects.all().select_related('parent')
    serializer_class = InternalEconomicClassifierSerializer
    permission_classes = [AllowAny]
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['code', 'name']
    filterset_fields = ['parent', 'is_active']

    def get_serializer_class(self):
        """
        Динамический выбор сериализатора. По умолчанию возвращает сериализатор вложенного дерева.
        Если в GET-запросе передан флаг ?list=true, бэкенд возвращает плоский список.
        """
        if self.request.query_params.get('list', 'false') == 'true':
            return InternalEconomicClassifierSerializer
        return InternalEconomicClassifierTreeSerializer

    def get_queryset(self):
        if not self.request:
            return super().get_queryset()

        is_flat_list = self.request.query_params.get('list', 'false').lower() == 'true'
        if is_flat_list:
            return super().get_queryset()

        return InternalEconomicClassifier.objects.filter(is_active=True, parent__isnull=True).prefetch_related('sub_codes')