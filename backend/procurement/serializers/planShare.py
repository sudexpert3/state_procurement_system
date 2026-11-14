import copy
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from procurement.models import PlanShare
from .department import DepartmentSerializer

class PlanShareSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanShare
        fields = ['id', 'status', 'budget_cost', 'department', 'shared_amount', 'shared_cost',
                  'shared_fund_cost', 'shared_inner_cost', 'change_request']

    def validate(self, attrs):
        # Превышение количества/суммы при распределении лимита по подразделениям проверяется
        # в PlanShare.clean() — но DRF не перехватывает django.core.exceptions.ValidationError,
        # брошенный из save()/full_clean(), поэтому без этой проверки превышение лимита падало
        # голым 500 вместо понятного 400 (найдено пользователем 2026-11-14). Прогоняем тот же
        # clean() на preview-копии ДО сохранения — тот же паттерн, что в
        # TreasuryPaymentSerializer.validate().
        if self.instance:
            preview = copy.copy(self.instance)
        else:
            preview = PlanShare()
        for field, value in attrs.items():
            setattr(preview, field, value)
        try:
            preview.clean()
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.message_dict if hasattr(e, 'message_dict') else e.messages)
        return attrs



class PlanShareForBudgetCustSerializer(serializers.ModelSerializer):
    department_detail = DepartmentSerializer(source='department', read_only=True)
    total_shared_cost = serializers.SerializerMethodField()
    class Meta:
        model = PlanShare
        fields = ['id', 'status', 'department_detail', 'shared_amount',
                  'total_shared_cost',
                  'shared_cost', 'shared_fund_cost', 'shared_inner_cost' ]

    def get_total_shared_cost(self, obj):
        return obj.shared_cost + obj.shared_fund_cost + obj.shared_inner_cost