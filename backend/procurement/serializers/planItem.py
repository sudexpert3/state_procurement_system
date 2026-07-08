from decimal import Decimal
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from core.choices import PlanItemStatus
from procurement.models import PlanItem, PlanShare, ContractItem
from .budgetCosts import BudgetCostsForItemSerializer, CostDetailResponseSchema, BudgetCostsForShortItemSerializer
from .planShare import PlanShareSerializer


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

    @extend_schema_field(serializers.ListField(child=BudgetCostsForShortItemSerializer()))
    def get_economic_details(self, obj):
        active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        return BudgetCostsForShortItemSerializer(active_budgets, many=True, context=self.context).data

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
    title = serializers.SerializerMethodField()
    okrb = serializers.SerializerMethodField()
    okrb_title = serializers.SerializerMethodField()
    type = serializers.SerializerMethodField()
    val_unit = serializers.SerializerMethodField()
    val_amount = serializers.SerializerMethodField()
    procedure_months = serializers.SerializerMethodField()
    is_by_organizator = serializers.SerializerMethodField()
    economic_details = serializers.SerializerMethodField()
    aggregated_cost = serializers.SerializerMethodField()


    class Meta:
        model = PlanItem
        fields = [
            'id', 'plan_purchase', 'num', 'is_public', 'is_active', 'created_at', 'updated_at',
            'title', 'okrb', 'okrb_title', 'type', 'val_unit', 'val_amount', 'procedure_months', 'is_by_organizator',
            'aggregated_cost', 'economic_details',
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

    @extend_schema_field(CostDetailResponseSchema)
    def get_aggregated_cost(self, obj):
        budget_cost, fund_cost, inner_cost =  Decimal('0.00'), Decimal('0.00'), Decimal('0.00')

        detail = self._get_active_detail(obj)
        if detail:
            fund_cost = detail.fund_cost
            inner_cost = detail.inner_cost

        active_bcs = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        if active_bcs:
            budget_cost = sum(Decimal(str(bc.cost)) for bc in active_bcs)

        total_cost = budget_cost + fund_cost + inner_cost

        return {
            "total_cost": total_cost,
            "budget_cost": budget_cost,
            "fund_cost": fund_cost,
            "inner_cost": inner_cost
        }

    @extend_schema_field(serializers.ListField(child=BudgetCostsForItemSerializer()))
    def get_economic_details(self, obj):
        active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        return BudgetCostsForItemSerializer(active_budgets, many=True, context=self.context).data


