from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from procurement.models import BudgetQuarterlyLimit
from procurement.serializers import BudgetQuarterlyLimitSerializer


class BudgetQuarterlyLimitViewSet(viewsets.ModelViewSet):
    """Read/write доступ к квартальным лимитам (Этап 3.3) — до этого у фронта не было
    способа найти текущие значения для формы «Перераспределить лимит»
    (doc/frontend_handoff.md, раздел 3.1), кроме ввода ID BudgetCosts/PlanShare руками.
    Запись напрямую (минуя ChangeRequest) по-прежнему не используется бизнес-процессом —
    эндпоинт в основном для чтения, но ModelViewSet оставлен для единообразия с остальным API."""
    queryset = BudgetQuarterlyLimit.objects.all().select_related(
        'budget_cost', 'budget_cost__plan_item', 'budget_cost__economic_class',
        'plan_share', 'plan_share__department',
    )
    serializer_class = BudgetQuarterlyLimitSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'budget_cost', 'budget_cost__year', 'plan_share', 'quarter', 'change_request']
