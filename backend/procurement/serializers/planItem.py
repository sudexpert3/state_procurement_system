from decimal import Decimal
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from core.choices import PlanItemStatus
from procurement.models import PlanItem, PlanShare, ContractItem
from .budgetCosts import BudgetCostsForItemSerializer, CostDetailResponseSchema, BudgetCostsForShortItemSerializer
from .planShare import PlanShareSerializer
from .buyer import BuyerSerializer


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
    okrb = serializers.SerializerMethodField()
    val_unit = serializers.SerializerMethodField()
    val_amount = serializers.SerializerMethodField()
    aggregated_cost = serializers.SerializerMethodField()
    economic_details = serializers.SerializerMethodField()
    matched_cost = serializers.SerializerMethodField()
    matched_details = serializers.SerializerMethodField()
    contracts = serializers.SerializerMethodField()
    contracts_count = serializers.SerializerMethodField()

    class Meta:
        model = PlanItem
        fields = [
            'id', 'num', 'title', 'okrb', 'val_unit', 'val_amount', 'aggregated_cost', 'economic_details',
            'matched_cost', 'matched_details',
            'contracts', 'contracts_count',
            'is_public', 'is_active', 'created_at', 'updated_at',
        ]

    def _get_active_detail(self, obj):
        """2026-11-24: баг — `active_pids[0]` падал `IndexError` для позиций без
        НИ ОДНОЙ активной `PlanItemDetail` (архивные/исключённые позиции, см. новый
        `?status_category=excluded` в views/planItem.py). Префетч в этом случае —
        ПУСТОЙ список (`[]`, не `None`), поэтому старая проверка `is None` его
        не отличала от "префетча вообще не было" и лезла в индекс несуществующего
        элемента."""
        active_pids = getattr(obj, 'active_plan_item_detail_prefetched', None)
        if active_pids is None:
            obj._cached_active_detail = obj.details.filter(status=PlanItemStatus.ACTIVE).first()
        else:
            obj._cached_active_detail = active_pids[0] if active_pids else None
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
        # 2026-11-06 (см. views/planItem.py): берём уже отфильтрованный и
        # select_related-нутый префетч вместо повторного запроса к БД на каждую
        # позицию плана. detail передаём через context — он один и тот же для
        # всех строк бюджета ЭТОЙ позиции, повторный запрос внутри
        # BudgetCostsForShortItemSerializer.get_full_cost() больше не нужен.
        active_budgets = getattr(obj, 'active_budget_costs_prefetched', None)
        if active_budgets is None:
            active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE).select_related(
                'internal_economic_class'
            )
        detail = self._get_active_detail(obj)
        context = {**self.context, 'plan_item_detail': detail}
        return BudgetCostsForShortItemSerializer(active_budgets, many=True, context=context).data

    @extend_schema_field(serializers.DecimalField(max_digits=15, decimal_places=2))
    def get_matched_cost(self, obj):
        """
        Правка 2026-11-17 (CurrentStatus.md): та же сумма, что и `aggregated_cost`, но
        только по строкам бюджета, подходящим под активный фильтр кода ЭКР в реестре
        закупок (`?functional_code=`/`?economic_code=`/`?internal_economic_code=`, см.
        `views/planItem.py`). Нужно фронту для футера реестра (`RegistryMoneySummary`) —
        сумма снизу должна учитывать выбранный фильтр, а САМА позиция (эта карточка,
        `aggregated_cost`/`economic_details`) должна показывать ПОЛНУЮ, объективную
        информацию по всем статьям независимо от фильтра (решение пользователя — раньше
        фильтр ошибочно скрывал часть реальных данных позиции). Без активного фильтра
        `matched_budget_costs_prefetched` совпадает с `active_budget_costs_prefetched`,
        поэтому `matched_cost` == `aggregated_cost`.
        """
        portal_cost = Decimal('0.00')
        detail = self._get_active_detail(obj)
        if detail:
            portal_cost = detail.fund_cost + detail.inner_cost

        matched_bcs = getattr(obj, 'matched_budget_costs_prefetched', None)
        if matched_bcs is None:
            matched_bcs = getattr(obj, 'active_budget_costs_prefetched', None)
        if matched_bcs is None:
            matched_bcs = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)

        budget_cost = sum(Decimal(str(bc.cost)) for bc in matched_bcs) if matched_bcs else Decimal('0.00')

        return float(portal_cost + budget_cost)

    @extend_schema_field(serializers.ListField(child=BudgetCostsForShortItemSerializer()))
    def get_matched_details(self, obj):
        """Строки бюджета, подходящие под активный фильтр — см. get_matched_cost."""
        matched_budgets = getattr(obj, 'matched_budget_costs_prefetched', None)
        if matched_budgets is None:
            matched_budgets = getattr(obj, 'active_budget_costs_prefetched', None)
        if matched_budgets is None:
            matched_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE).select_related(
                'internal_economic_class'
            )
        detail = self._get_active_detail(obj)
        context = {**self.context, 'plan_item_detail': detail}
        return BudgetCostsForShortItemSerializer(matched_budgets, many=True, context=context).data

    @extend_schema_field(serializers.BooleanField)
    def get_contracts(self, obj):
        # 2026-11-06: в списке (action=list) поле уже посчитано одним SQL-подзапросом
        # (annotate has_contracts в get_queryset) — не делаем отдельный .exists() на
        # каждую позицию. Фоллбэк — для случаев без аннотации (retrieve/прочее).
        has_contracts = getattr(obj, 'has_contracts', None)
        if has_contracts is not None:
            return has_contracts

        active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        plan_shares = PlanShare.objects.filter(
            budget_cost__in=active_budgets,
            status=PlanItemStatus.ACTIVE
        )
        return ContractItem.objects.filter(plan_share__in=plan_shares).exists()

    @extend_schema_field(serializers.IntegerField())
    def get_contracts_count(self, obj):
        # Запрос фронтенда (frontend_handoff.md, раздел 9.1) — число УНИКАЛЬНЫХ договоров,
        # а не строк ContractItem (у одного договора может быть несколько ContractItem на
        # разные подразделения/строки одной позиции — см. CurrentStatus.md, пример
        # 2026-102377498-66, 14 договоров на охрану от разных отделов). Поле `contracts`
        # (boolean) оставлено как есть — contracts_count отдельное, дополнительное поле.
        contracts_count = getattr(obj, 'contracts_count', None)
        if contracts_count is not None:
            return contracts_count

        active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
        plan_shares = PlanShare.objects.filter(
            budget_cost__in=active_budgets,
            status=PlanItemStatus.ACTIVE
        )
        return ContractItem.objects.filter(plan_share__in=plan_shares).values('contract').distinct().count()


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
    aggregated_cost = serializers.SerializerMethodField()
    economic_details = serializers.SerializerMethodField()
    buyer_detail = serializers.SerializerMethodField()


    class Meta:
        model = PlanItem
        fields = [
            'id', 'plan_purchase', 'num', 'is_public', 'is_active', 'created_at', 'updated_at',
            'title', 'okrb', 'okrb_title', 'type', 'val_unit', 'val_amount', 'procedure_months', 'is_by_organizator',
            'buyer_detail', 'aggregated_cost', 'economic_details',
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

    @extend_schema_field(serializers.ListField(child=BuyerSerializer()))
    def get_buyer_detail(self, obj):
        detail = self._get_active_detail(obj)
        ob = detail.buyer if detail else None
        return BuyerSerializer(ob).data if ob else None

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
        # Та же оптимизация, что в PlanItemShortSerializer (см. CurrentStatus.md Этап 4.6) —
        # здесь объект один (карточка позиции), но нет смысла заново запрашивать details
        # на каждую строку бюджета, когда они все про одну и ту же активную деталь позиции.
        active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE).select_related(
            'internal_economic_class', 'functional_class', 'economic_class', 'program_class'
        )
        detail = self._get_active_detail(obj)
        context = {**self.context, 'plan_item_detail': detail}
        return BudgetCostsForItemSerializer(active_budgets, many=True, context=context).data


