from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny

from procurement.models import FunctionalCode
from procurement.serializers import FunctionalCodeSerializer


class FunctionalCodeViewSet(viewsets.ModelViewSet):
    queryset = FunctionalCode.objects.all()
    serializer_class = FunctionalCodeSerializer
    permission_classes = [AllowAny]  # Временный режим локальной отладки без авторизации
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    pagination_class = None
    search_fields = ['code_api', 'description']
    filterset_fields = ['is_active']

    def get_queryset(self):
        queryset = super().get_queryset()

        if 'is_active' not in self.request.query_params:
            return queryset.filter(is_active=True)

        return queryset