from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny

from procurement.models import OkrbProduct
from procurement.serializers import OkrbProductSerializer


class OkrbProductViewSet(viewsets.ModelViewSet):
    queryset = OkrbProduct.objects.all()
    serializer_class = OkrbProductSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    pagination_class = None
    search_fields = ['code', 'title']
    filterset_fields = ['is_active']

    def get_queryset(self):
        queryset = super().get_queryset()

        if 'is_active' not in self.request.query_params:
            return queryset.filter(is_active=True)

        return queryset
