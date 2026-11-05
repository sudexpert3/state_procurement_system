from rest_framework import serializers

from procurement.models import BudgetQuarterlyLimit


class BudgetQuarterlyLimitSerializer(serializers.ModelSerializer):
    """Read-эндпоинт для выбора существующих квартальных лимитов при перераспределении
    (doc/frontend_handoff.md, раздел 3.1) — до этого у фронта не было способа найти
    BudgetCosts/PlanShare по статье/году/подразделению иначе, кроме ввода ID руками."""
    year = serializers.IntegerField(source='budget_cost.year', read_only=True)
    economic_code = serializers.CharField(source='budget_cost.economic_code', read_only=True)
    plan_item_num = serializers.CharField(source='budget_cost.plan_item.num', read_only=True, default=None)
    department_name = serializers.CharField(source='plan_share.department.short_name', read_only=True, default=None)

    class Meta:
        model = BudgetQuarterlyLimit
        fields = [
            'id', 'status', 'budget_cost', 'year', 'economic_code', 'plan_item_num',
            'plan_share', 'department_name', 'quarter', 'amount', 'change_request',
            'created_at', 'changed_at',
        ]
