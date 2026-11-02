from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from ..models import ContractQuarterlyFinance
from ..serializers import ContractQuarterlyFinanceSerializer


class ContractQuarterlyFinanceViewSet(viewsets.ModelViewSet):
    """Эндпоинт ручной корректировки квартального плана договора (Этап 4.3).

    planned_cost правится специалистом вручную; actual_cost пересчитывается
    автоматически по платёжкам (TreasuryPayment) и, как правило, не редактируется
    напрямую через этот эндпоинт — попытка завысить его сверх суммы договора будет
    отклонена той же проверкой, что действует при разнесении платежа."""
    queryset = ContractQuarterlyFinance.objects.all().select_related('contract', 'contract_item')
    serializer_class = ContractQuarterlyFinanceSerializer
    permission_classes = [AllowAny]  # Временный отладочный режим системы
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['contract', 'contract_item', 'year', 'quarter']
