from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from procurement.serializers import ProcurementMethodDetailSerializer, ProcurementMethodTreeSerializer
from procurement.models import ProcurementMethodDetail


class ProcurementMethodDetailViewSet(viewsets.ModelViewSet):
    """Эндпоинт вывода пунктов и статей процедур госзакупок РБ"""
    queryset = ProcurementMethodDetail.objects.filter(is_active=True).select_related('parent')
    serializer_class = ProcurementMethodDetailSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['parent', 'is_active']
    pagination_class = None

    def get_serializer_class(self):
        if self.request.query_params.get('list', 'false') == 'true':
            return ProcurementMethodDetailSerializer
        return ProcurementMethodTreeSerializer

    def get_queryset(self):
        if not self.request:
            return super().get_queryset()

        is_flat_list = self.request.query_params.get('list', 'false').lower() == 'true'
        if is_flat_list:
            return super().get_queryset()

        return ProcurementMethodDetail.objects.filter(is_active=True, parent__isnull=True).prefetch_related('sub_methods')
