from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny

from procurement.models import ProgramCode
from procurement.serializers import ProgramCodeSerializer


class ProgramCodeViewSet(viewsets.ModelViewSet):
    queryset = ProgramCode.objects.all()
    serializer_class = ProgramCodeSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    pagination_class = None
    search_fields = ['code_api', 'description']
    filterset_fields = ['is_active']

    def get_queryset(self):
        queryset = super().get_queryset()

        if 'is_active' not in self.request.query_params:
            return queryset.filter(is_active=True)

        return queryset