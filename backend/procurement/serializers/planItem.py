from decimal import Decimal
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from core.choices import PlanItemStatus
from procurement.models import PlanItem, PlanShare, ContractItem
from .budgetCosts import BudgetCostsForItemSerializer, BudgetCostsSerializer, InternalEconomicClassifierSerializer, BudgetCostsForShortItemSerializer
from .planItemDetail import PlanItemDetailSerializer


class PlanItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanItem
        fields = ['id', 'plan_purchase', 'num', 'is_public', 'is_active', 'created_at', 'updated_at', ]


class PlanItemShortSerializer(serializers.ModelSerializer):
    """
    Канонический сериализатор позиций ГПЗ для собственного React-фронтенда.
    Автоматически собирает плоский корень, активный текст и финансовые лимиты.
    """

    title = serializers.SerializerMethodField()
    val_unit = serializers.SerializerMethodField()
    val_amount = serializers.SerializerMethodField()
    aggregated_cost = serializers.SerializerMethodField()
    economic_details = serializers.SerializerMethodField()
    contracts = serializers.SerializerMethodField()

    class Meta:
        model = PlanItem
        fields = [
            'id', 'num', 'title', 'val_unit', 'val_amount', 'aggregated_cost', 'economic_details', 'contracts',
            'is_public', 'is_active', 'created_at', 'updated_at',
        ]

    def _get_active_detail(self, obj):
        # if not hasattr(obj, '_cached_active_detail'):
        #     obj._cached_active_detail = obj.details.filter(status=PlanItemStatus.ACTIVE).first()

        active_pids = getattr(obj, 'active_plan_item_detail_prefetched', None)
        obj._cached_active_detail = obj.details.filter(status=PlanItemStatus.ACTIVE).first() if active_pids is None else active_pids[0]
        return obj._cached_active_detail

    @extend_schema_field(serializers.CharField())
    def get_title(self, obj):
        detail = self._get_active_detail(obj)
        return detail.title if detail else None

    @extend_schema_field(serializers.CharField())
    def get_val_unit(self, obj):
        detail = self._get_active_detail(obj)
        return detail.val_unit.short_name if detail and detail.val_unit else None

    @extend_schema_field(serializers.DecimalField(max_digits=12, decimal_places=3))
    def get_val_amount(self, obj):
        detail = self._get_active_detail(obj)
        return detail.val_amount if detail else None

    @extend_schema_field(serializers.ListField(child=serializers.IntegerField()))
    def get_years(self, obj):
        active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        return [bc.year for bc in active_budgets] if active_budgets else []

    @extend_schema_field(serializers.DecimalField(max_digits=15, decimal_places=2))
    def get_aggregated_cost(self, obj):
        """
        Казначейский расчет полной стоимости позиции закупки.
        Суммирует только ACTIVE финансовые лимиты Минфина РБ.
        """
        portal_cost = Decimal('0.00')
        detail = self._get_active_detail(obj)
        if detail:
            portal_cost = detail.fund_cost + detail.inner_cost

        active_bcs = getattr(obj, 'active_budget_costs_prefetched', [])
        if not active_bcs:
            active_bcs = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)

        budget_cost = sum(Decimal(str(bc.cost)) for bc in active_bcs) if active_bcs else Decimal('0.00')

        return float(portal_cost + budget_cost)

    @extend_schema_field(serializers.ListField(child=serializers.DecimalField(max_digits=15, decimal_places=2)))
    def get_cost_list(self, obj):
        active_bcs = getattr(obj, 'active_budget_costs_prefetched', [])
        if not active_bcs:
            active_bcs = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)

        return [bc.cost for bc in active_bcs] if active_bcs else []

    @extend_schema_field(serializers.ListField(child=BudgetCostsForShortItemSerializer()))
    def get_economic_details(self, obj):
        active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        return BudgetCostsForShortItemSerializer(active_budgets, many=True, context=self.context).data

    # @extend_schema_field(serializers.ListField(child=InternalEconomicClassifierSerializer()))
    # def get_internal_economic_class(self, obj):
    #     active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
    #
    #     return [InternalEconomicClassifierSerializer(source= bc.internal_economic_class, read_only=True) for bc in active_budgets] if active_budgets else []

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_functional_codes_api(self, obj):
        active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        return [bc.functional_code for bc in active_budgets] if active_budgets else []

    @extend_schema_field(serializers.BooleanField)
    def get_contracts(self, obj):
        active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        plan_shares = PlanShare.objects.filter(
            budget_cost__in=active_budgets,
            status=PlanItemStatus.ACTIVE
        )
        contracts_queryset = ContractItem.objects.filter(plan_share__in=plan_shares).distinct()

        return contracts_queryset.exists()


class PlanItemFullSerializer(serializers.ModelSerializer):
    """
    Cериализатор позиций ГПЗ для React-фронтенда.
    Автоматически собирает корень, актуальную детальную информацию текст и финансовые лимиты.
    """
    # 1. Выводим год и номер родительского плана Purchases для заголовков таблиц
    title = serializers.SerializerMethodField()
    okrb = serializers.SerializerMethodField()
    okrb_title = serializers.SerializerMethodField()
    type = serializers.SerializerMethodField()
    val_unit = serializers.SerializerMethodField()
    val_amount = serializers.SerializerMethodField()
    aggregated_cost = serializers.SerializerMethodField()
    procedure_months = serializers.SerializerMethodField()
    is_by_organizator = serializers.SerializerMethodField()
    active_budget_costs = serializers.SerializerMethodField()

    # purchase_year = serializers.IntegerField(source='plan_purchase.year', read_only=True)
    # active_details = serializers.SerializerMethodField()
    # all_details = serializers.SerializerMethodField()
    # active_budget_costs = serializers.SerializerMethodField()
    # all_budget_costs = serializers.SerializerMethodField()

    class Meta:
        model = PlanItem
        fields = [
            'id', 'plan_purchase', 'num', 'is_public', 'is_active', 'created_at', 'updated_at',
            'title', 'okrb', 'okrb_title', 'type', 'val_unit', 'val_amount', 'procedure_months', 'is_by_organizator',
            'active_budget_costs',
            'aggregated_cost',

            # 'purchase_year',
            # 'active_details', 'all_details', 'active_budget_costs', 'all_budget_costs'
        ]

    def _get_active_detail(self, obj):
        if not hasattr(obj, '_cached_active_detail'):
            obj._cached_active_detail = obj.details.filter(status=PlanItemStatus.ACTIVE).first()
        return obj._cached_active_detail

    @extend_schema_field(serializers.CharField())
    def get_title(self, obj):
        detail = self._get_active_detail(obj)
        return detail.title if detail else None

    @extend_schema_field(serializers.CharField())
    def get_okrb(self, obj):
        detail = self._get_active_detail(obj)
        return detail.okrb if detail else None

    @extend_schema_field(serializers.CharField())
    def get_okrb_title(self, obj):
        detail = self._get_active_detail(obj)
        return detail.okrb_title if detail else None

    @extend_schema_field(serializers.CharField())
    def get_type(self, obj):
        detail = self._get_active_detail(obj)
        return detail.type if detail else None

    @extend_schema_field(serializers.CharField())
    def get_val_unit(self, obj):
        detail = self._get_active_detail(obj)
        return detail.val_unit.short_name if detail and detail.val_unit else None

    @extend_schema_field(serializers.DecimalField(max_digits=12, decimal_places=3))
    def get_val_amount(self, obj):
        detail = self._get_active_detail(obj)
        return detail.val_amount if detail else None

    @extend_schema_field(serializers.ListField(child=serializers.IntegerField()))
    def get_procedure_months(self, obj):
        detail = self._get_active_detail(obj)
        return detail.procedure_months if detail else None

    @extend_schema_field(serializers.ListField(child=serializers.IntegerField()))
    def get_is_by_organizator(self, obj):
        detail = self._get_active_detail(obj)
        return detail.is_by_organizator if detail else False

    @extend_schema_field(serializers.DecimalField(max_digits=15, decimal_places=2))
    def get_aggregated_cost(self, obj):
        """
        Казначейский расчет полной стоимости позиции закупки.
        Суммирует только ACTIVE финансовые лимиты Минфина РБ.
        """
        detail = self._get_active_detail(obj)
        portal_cost = (detail.fund_cost + detail.inner_cost) if detail else Decimal('0.00')

        active_bcs = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        budget_cost = sum(Decimal(str(bc.cost)) for bc in active_bcs) if active_bcs else Decimal('0.00')

        return portal_cost + budget_cost

    def get_active_details(self, obj):
        active_details = obj.details.filter(status=PlanItemStatus.ACTIVE)
        return PlanItemDetailSerializer(active_details, many=True, context=self.context).data

    def get_all_details(self, obj):
        return PlanItemDetailSerializer(obj.details.all(), many=True, context=self.context).data

    def get_active_budget_costs(self, obj):
        active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        return BudgetCostsForItemSerializer(active_budgets, many=True, context=self.context).data

    def get_all_budget_costs(self, obj):
        return BudgetCostsSerializer(obj.budget_costs.all(), many=True, context=self.context).data
