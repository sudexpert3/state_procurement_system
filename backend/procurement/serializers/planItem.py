from rest_framework import serializers
from django.db import transaction
from core.choices import PlanItemStatus
from procurement.models import PlanItem, PlanItemDetail, BudgetCosts, OkrbProduct, UnitOfMeasurement
from .budgetCosts import BudgetCostsSerializer
from .planItemDetail import PlanItemDetailSerializer


class PlanItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanItem
        fields = ['id', 'purchase', 'num', 'is_public', 'is_active', 'created_at', 'updated_at', ]


class PlanItemShortSerializer(serializers.ModelSerializer):
    """
    Канонический сериализатор позиций ГПЗ для собственного React-фронтенда.
    Автоматически собирает плоский корень, активный текст и финансовые лимиты.
    """
    # 1. Выводим год и номер родительского плана Purchases для заголовков таблиц
    purchase_year = serializers.IntegerField(source='purchase.year', read_only=True)
    active_details = serializers.SerializerMethodField()
    active_budget_costs = serializers.SerializerMethodField()

    class Meta:
        model = PlanItem
        fields = [
            'id', 'purchase', 'purchase_year', 'num', 'is_public', 'is_active', 'created_at', 'updated_at',
            'active_details', 'active_budget_costs'
        ]

    def get_active_details(self, obj):
        active_details = obj.details.filter(status=PlanItemStatus.ACTIVE)
        return PlanItemDetailSerializer(active_details, many=True, context=self.context).data

    def get_active_budget_costs(self, obj):
        active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        return BudgetCostsSerializer(active_budgets, many=True, context=self.context).data


class PlanItemFullSerializer(serializers.ModelSerializer):
    """
    Канонический сериализатор позиций ГПЗ для собственного React-фронтенда.
    Автоматически собирает плоский корень, активный текст и финансовые лимиты.
    """
    # 1. Выводим год и номер родительского плана Purchases для заголовков таблиц
    purchase_year = serializers.IntegerField(source='purchase.year', read_only=True)
    active_details = serializers.SerializerMethodField()
    all_details = serializers.SerializerMethodField()
    active_budget_costs = serializers.SerializerMethodField()
    all_budget_costs = serializers.SerializerMethodField()

    class Meta:
        model = PlanItem
        fields = [
            'id', 'purchase', 'purchase_year', 'num', 'is_public', 'is_active', 'created_at', 'updated_at',
            'active_details', 'all_details', 'active_budget_costs', 'all_budget_costs'
        ]

    def get_active_details(self, obj):
        active_details = obj.details.filter(status=PlanItemStatus.ACTIVE)
        return PlanItemDetailSerializer(active_details, many=True, context=self.context).data

    def get_all_details(self, obj):
        return PlanItemDetailSerializer(obj.details.all(), many=True, context=self.context).data

    def get_active_budget_costs(self, obj):
        active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        return BudgetCostsSerializer(active_budgets, many=True, context=self.context).data

    def get_all_budget_costs(self, obj):
        return BudgetCostsSerializer(obj.budget_costs.all(), many=True, context=self.context).data

