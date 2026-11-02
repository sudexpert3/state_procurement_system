import copy

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from procurement.models import ContractQuarterlyFinance


class ContractQuarterlyFinanceSerializer(serializers.ModelSerializer):
    """Квартальный план/факт договора (Этап 4.3) — специалист вручную корректирует
    planned_cost (ручная правка квартального плана), actual_cost пересчитывается
    автоматически по платёжкам (см. TreasuryPayment.save()) и обычно не правится руками."""

    class Meta:
        model = ContractQuarterlyFinance
        fields = ['id', 'contract', 'contract_item', 'quarter', 'year', 'planned_cost', 'actual_cost']

    def validate(self, attrs):
        # См. TreasuryPaymentSerializer.validate() — тот же приём: прогоняем модельный
        # clean() (контроль превышения факта нарастающим итогом) заранее, чтобы вернуть
        # чистый 400, а не необработанный 500 из full_clean() внутри save().
        if self.instance:
            preview = copy.copy(self.instance)
        else:
            preview = ContractQuarterlyFinance()
        for field, value in attrs.items():
            setattr(preview, field, value)
        try:
            preview.clean()
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.message_dict if hasattr(e, 'message_dict') else e.messages)
        return attrs
