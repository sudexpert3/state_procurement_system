from rest_framework import serializers
from django.core.exceptions import ValidationError
from procurement.models import TreasuryPayment


class TreasuryPaymentSerializer(serializers.ModelSerializer):
    """Сериализатор платежных поручений (Фактические кассовые оплаты)"""

    class Meta:
        model = TreasuryPayment
        fields = ['id', 'contract', 'payment_number', 'payment_date', 'amount', 'created_at']

        def validate(self, data):
            # Вызов полной валидации модели (включая проверку перерасхода договора)
            instance = TreasuryPayment(**data)
            try:
                instance.full_clean()
            except ValidationError as e:
                raise serializers.ValidationError(e.message_dict)
            return data
