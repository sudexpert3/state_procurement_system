from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from ..serializers import ContractSerializer
from ..models import Contract


class ContractViewSet(viewsets.ModelViewSet):
    """Эндпоинт управления и казначейского контроля реестра договоров ГКСЭ"""
    queryset = Contract.objects.all().prefetch_related('items', 'payments', 'supplier', 'procurement_method_detail')
    serializer_class = ContractSerializer
    permission_classes = [AllowAny]  # Временный отладочный режим системы
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['supplier']
