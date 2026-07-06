from decimal import Decimal

from rest_framework import serializers
from core.choices import PlanItemStatus
from procurement.models import PlanItem, PlanShare, ContractItem
from .budgetCosts import BudgetCostsSerializer
from .planItemDetail import PlanItemDetailSerializer
from .contract import ContractItemSerializer


class PlanItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanItem
        fields = ['id', 'plan_purchase', 'num', 'is_public', 'is_active', 'created_at', 'updated_at', ]


class PlanItemShortSerializer(serializers.ModelSerializer):
    """
    Канонический сериализатор позиций ГПЗ для собственного React-фронтенда.
    Автоматически собирает плоский корень, активный текст и финансовые лимиты.
    """
    # 1. Выводим год и номер родительского плана Purchases для заголовков таблиц
    title = serializers.CharField(source='details.title', read_only=True)
    val_unit = serializers.CharField(source='details.val_unit.short_name', read_only=True)
    val_amount = serializers.DecimalField(source='details.val_amount', read_only=True, max_digits=12, decimal_places=3)
    years = serializers.SerializerMethodField()
    aggregated_cost = serializers.SerializerMethodField()
    economic_codes_api = serializers.SerializerMethodField()
    functional_codes_api = serializers.SerializerMethodField()
    contracts = serializers.SerializerMethodField()

    # active_details = serializers.SerializerMethodField()
    # active_budget_costs = serializers.SerializerMethodField()

    class Meta:
        model = PlanItem
        fields = [
            'id', 'num', 'title', 'val_unit', 'val_amount', 'aggregated_cost', 'years', 'economic_codes_api',
            'functional_codes_api', 'contracts',
            'is_public', 'is_active', 'created_at', 'updated_at',
            # 'active_details', 'active_budget_costs'
        ]


    def get_years(self, obj):
        active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        return [bc.year for bc in active_budgets] if active_budgets else []

    def get_aggregated_cost(self, obj):
        """
        Казначейский расчет полной стоимости позиции закупки.
        Суммирует только ACTIVE финансовые лимиты Минфина РБ.
        """
        active_pids = getattr(obj, 'active_plan_item_detail_prefetched', None)
        if active_pids is None:
            active_pids = obj.details.filter(status=PlanItemStatus.ACTIVE)

        portal_cost = Decimal('0.00')
        if active_pids:
            active_detail = active_pids[0] if isinstance(active_pids, list) else active_pids.first()
            if active_detail:
                portal_cost = active_detail.fund_cost + active_detail.inner_cost

        active_bcs = getattr(obj, 'active_budget_costs_prefetched', [])
        if not active_bcs:
            active_bcs = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)

        budget_cost = sum(Decimal(str(bc.cost)) for bc in active_bcs) if active_bcs else Decimal('0.00')

        return float(portal_cost + budget_cost)

    def get_economic_codes_api(self, obj):
        active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        return [bc.economic_code for bc in active_budgets] if active_budgets else []

    def get_functional_codes_api(self, obj):
        active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        return [bc.functional_code for bc in active_budgets] if active_budgets else []

    def get_contracts(self, obj):
        active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        plan_shares = PlanShare.objects.filter(
            budget_cost__in=active_budgets,
            status=PlanItemStatus.ACTIVE
        )
        contracts_queryset = ContractItem.objects.filter(plan_share__in=plan_shares).distinct()

        # return ContractItemSerializer(contracts_queryset, many=True, context=self.context).data
        return contracts_queryset.exists()


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
    purchase_year = serializers.IntegerField(source='plan_purchase.year', read_only=True)
    active_details = serializers.SerializerMethodField()
    all_details = serializers.SerializerMethodField()
    active_budget_costs = serializers.SerializerMethodField()
    all_budget_costs = serializers.SerializerMethodField()

    class Meta:
        model = PlanItem
        fields = [
            'id', 'plan_purchase', 'purchase_year', 'num', 'is_public', 'is_active', 'created_at', 'updated_at',
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

