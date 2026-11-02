import copy

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from procurement.models import TreasuryPayment
from procurement.models.treasuryPayment import KindOfPayment
from procurement.serializers.department import DepartmentSerializer
from procurement.serializers.internalEconomicClassifier import InternalEconomicClassifierSerializer
from procurement.serializers.externalEconomicCode import ExternalEconomicCodeSerializer
from procurement.serializers.functionalCode import FunctionalCodeSerializer
from procurement.serializers.programCode import ProgramCodeSerializer


class KindOfPaymentSerializer(serializers.ModelSerializer):
    """Справочник видов платежей (обычный / возврат-восстановление кассового расхода)"""

    class Meta:
        model = KindOfPayment
        fields = ['id', 'name', 'is_refund']


class TreasuryPaymentSerializer(serializers.ModelSerializer):
    """Сериализатор платежных поручений (фактические кассовые оплаты).

    Поддерживает два сценария (Этап 4.1):
    - оплата по договору (contract заполнен) — списывается с конкретной строки договора;
    - "свободная" платёжка без договора (contract пуст) — относится на статью расходов
      (functional_class/economic_class/internal_economic_class) и подразделения (departments)
      напрямую, без привязки к позиции плана.
    """
    # Вложенные представления для удобства фронтенда — только для чтения, пишем через *_id поля
    kind_detail = KindOfPaymentSerializer(source='kind', read_only=True)
    departments_detail = DepartmentSerializer(source='departments', many=True, read_only=True)
    internal_economic_class_detail = InternalEconomicClassifierSerializer(source='internal_economic_class',
                                                                           read_only=True)
    economic_class_detail = ExternalEconomicCodeSerializer(source='economic_class', read_only=True)
    functional_class_detail = FunctionalCodeSerializer(source='functional_class', read_only=True)
    program_class_detail = ProgramCodeSerializer(source='program_class', read_only=True)

    # Квартал вычисляется автоматически из payment_date в TreasuryPayment.save() — только чтение
    quarter = serializers.CharField(read_only=True)

    class Meta:
        model = TreasuryPayment
        fields = [
            'id', 'contract', 'quarter', 'payment_number', 'payment_year', 'payment_date',
            'save_date', 'created_at', 'changed_at', 'amount', 'kind', 'kind_detail', 'notice',
            'internal_economic_class', 'internal_economic_class_detail',
            'economic_class', 'economic_class_detail',
            'functional_class', 'functional_class_detail',
            'program_class', 'program_class_detail',
            'departments', 'departments_detail',
        ]

    def validate(self, attrs):
        # Прогоняем те же бизнес-проверки, что и модельный clean() внутри save() (сумма > 0,
        # контроль казначейского перерасхода по договору) — ДО сохранения, чтобы вернуть
        # чистый 400 с понятным текстом, а не необработанный 500 (DRF не перехватывает
        # django.core.exceptions.ValidationError из save()). Собираем предварительный объект
        # как копию текущего инстанса (для PATCH) с наложенными изменёнными полями —
        # departments (M2M) в clean() не участвует, поэтому не переносим.
        if self.instance:
            preview = copy.copy(self.instance)
        else:
            preview = TreasuryPayment()
        for field, value in attrs.items():
            if field != 'departments':
                setattr(preview, field, value)
        try:
            preview.clean()
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.message_dict if hasattr(e, 'message_dict') else e.messages)
        return attrs
