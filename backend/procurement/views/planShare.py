from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from ..models import PlanShare
from ..serializers import PlanShareSerializer


class PlanShareViewSet(viewsets.ModelViewSet):
    """Распределение лимита по подразделениям — в т.ч. для редактирования черновиков
    PLAN_ITEM_CHANGE (ChangeRequest), где клонированные DRAFT-записи правятся через
    обычный PATCH (фронтенд фильтрует по change_request)."""
    queryset = PlanShare.objects.all().select_related('department', 'budget_cost')
    serializer_class = PlanShareSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'budget_cost', 'department', 'change_request']
