from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from ..serializers import ProcurementMethodDetailSerializer
from ..models import ProcurementMethodDetail


class ProcurementMethodDetailViewSet(viewsets.ModelViewSet):
    """Эндпоинт вывода пунктов и статей процедур госзакупок РБ"""
    queryset = ProcurementMethodDetail.objects.all()
    serializer_class = ProcurementMethodDetailSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['parent']
    pagination_class = None

    def get_queryset(self):
        queryset = ProcurementMethodDetail.objects.all()

        params = self.request.query_params
        print(params)

        is_active = params.get('is_active', 'True').lower() == 'true'
        queryset = queryset.filter(is_active=is_active)

        parent = params.get('parent', None)
        no_parent = params.get('parent__isnull', '').lower() == 'true'

        if parent and int(parent):
            queryset = queryset.filter(parent=parent)
            
        if no_parent:
            queryset = queryset.filter(parent__isnull=True)

        return queryset
