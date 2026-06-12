from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from ..serializers import SupplierSerializer
from ..models import Supplier


class SupplierViewSet(viewsets.ModelViewSet):
    """Эндпоинт управления ведомственным справочником контрагентов"""
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [AllowAny]
    pagination_class = None

