from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from ..models import DepartmentArticleLimit
from ..serializers import DepartmentArticleLimitSerializer


class DepartmentArticleLimitViewSet(viewsets.ModelViewSet):
    """CRUD строк калибровки (подстатьи/держатели лимита) — черновик правится через этот
    эндпоинт (status=DRAFT, change_request=<заявка>), сверка — через
    /api/change_requests/{id}/forecast/."""
    queryset = DepartmentArticleLimit.objects.all().select_related(
        'functional_class', 'economic_class', 'internal_economic_class', 'department',
    )
    serializer_class = DepartmentArticleLimitSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'change_request', 'functional_class', 'economic_class', 'department', 'year']
