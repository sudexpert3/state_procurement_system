from decimal import Decimal

from django.db import transaction
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from core.choices import PlanItemStatus
from procurement.models import FunctionalCode, ProgramCode, BudgetCosts, ExternalEconomicCode, PlanShare

from .internalEconomicClassifier import InternalEconomicClassifierSerializer
from .externalEconomicCode import ExternalEconomicCodeSerializer
from .functionalCode import FunctionalCodeSerializer
from .programCode import ProgramCodeSerializer
from .planShare import PlanShareForBudgetCustSerializer

# =====================================================================
# 1. СЕРИАЛИЗАТОР ИМПОРТА (для парсинга goszakupki.by)
# =====================================================================
class BudgetCostsImportSerializer(serializers.ModelSerializer):
    """Используется для POST/каскадного импорта 'сырых' финансовых данных из ИС Тендеры"""
    # functional_class: "03_12_00 § 039" - это справочник для functional_code: "3 12 0 39"
    # economic_class "1.10.10.99 Прочие текущие расходы" - это справочник для economic_code: "1 10 10 99"
    # program_class: "99 00"  - это справочник для program_code: "99 0"

    class Meta:
        model = BudgetCosts
        fields = [
            "purchases_items_id", "cost", "functional_code", 'functional_class', "department_code",
            "economic_code", 'economic_class', "program_code", 'program_class', "budget_code", "budget_code_name",
            "unk", "tk_id", "year", "plan_item", "status", "internal_economic_class", "internal_economic_section",
            "internal_economic_subsection", "internal_economic_kind", "internal_economic_article", 'created_at', 'changed_at',
        ]

        extra_kwargs = {
            'plan_item': {'required': False},
            'status': {'required': False},
            'created_at': {'required': False},
            'changed_at': {'required': False},
            'functional_class': {'required': False, 'allow_null': True},
            'economic_class': {'required': False, 'allow_null': True},
            'program_class': {'required': False, 'allow_null': True},
            'internal_economic_class': {'required': False, 'allow_null': True},
            'internal_economic_section': {'required': False, 'allow_null': True},
            'internal_economic_subsection': {'required': False, 'allow_null': True},
            'internal_economic_kind': {'required': False, 'allow_null': True},
            'internal_economic_article': {'required': False, 'allow_null': True},
        }


    def to_internal_value(self, data):
        """ Очистка сырых данных, полученных от goszakupki.by """
        if not isinstance(data, dict):
            return super().to_internal_value(data)

        raw_data = data.copy()
        for field in ['functional_code', 'department_code', 'economic_code', 'program_code', 'budget_code_name', 'unk']:
            if field in raw_data and (raw_data[field] is None or str(raw_data[field]).strip() == ""):
                raw_data[field] = None
            else:
                raw_data[field] = str(raw_data[field]).strip()

        # Страхуем входящие числовые поля, если API прислало их в виде текста
        for decimal_field in ['cost']:
            if decimal_field in raw_data and isinstance(raw_data[decimal_field], str):
                raw_data[decimal_field] = raw_data[decimal_field].replace(',', '.').strip()

        if raw_data['functional_code']:
            if raw_data['functional_code'] == "3 12 0 39":
                raw_data['functional_code'] = "03 12 00 039"

        if raw_data['economic_code']:
            if raw_data['economic_code'] == "1 10 3 99":
                raw_data['economic_code'] = "1 10 03 99"
            elif raw_data['economic_code'] == "1 10 4 0":
                raw_data['economic_code'] = "1 10 04 00"
            elif raw_data['economic_code'] == "1 10 5 0":
                raw_data['economic_code'] = "1 10 05 00"
            elif raw_data['economic_code'] == "1 10 6 0":
                raw_data['economic_code'] = "1 10 06 00"
            elif raw_data['economic_code'] == "1 10 7 99":
                raw_data['economic_code'] = "1 10 07 99"

        if raw_data['program_code']:
            if raw_data['program_code'] == "99 0":
                raw_data['program_code'] = "099 00"

        return super().to_internal_value(raw_data)

    def validate(self, attrs):
        """ Автоматическое связывание со справочниками.
           Превращает сырые коды Минфина в полноценные объекты СУБД PostgreSQL.
        """

        raw_func_code = attrs.get("functional_code", None)
        if raw_func_code:
            func_obj, _ = FunctionalCode.objects.get_or_create(
                code_api=raw_func_code,
                defaults={"description": f"Новый код из API: {raw_func_code}", "is_active": True}
            )
            attrs["functional_class"] = func_obj

        raw_prog_code = attrs.get("program_code", None)
        if raw_prog_code:
            prog_obj, _ = ProgramCode.objects.get_or_create(
                code_api=raw_prog_code,
                defaults={"description": f"Новый код из API: {raw_prog_code}", "is_active": True}
            )
            attrs["program_class"] = prog_obj

        raw_econ_code = attrs.get("economic_code", None)
        if raw_econ_code:
            econ_obj, _ = ExternalEconomicCode.objects.get_or_create(
                code_api=raw_econ_code,
                defaults={"description": f"Новый код из API: {raw_econ_code}", "is_active": True}
            )
            attrs["economic_class"] = econ_obj

        return attrs

    def create(self, validated_data):
        """Идемпотентная запись: проверка дубликатов и сохранение строки финансирования"""
        plan_item = validated_data.get('plan_item')

        existing_bc_qs = BudgetCosts.objects.filter(
            plan_item=plan_item,
            purchases_items_id=validated_data.get('purchases_items_id'),
            cost=validated_data.get('cost'),
            functional_code=validated_data.get('functional_code'),
            department_code=validated_data.get('department_code'),
            economic_code=validated_data.get('economic_code'),
            program_code=validated_data.get('program_code'),
            budget_code=validated_data.get('budget_code'),
            budget_code_name=validated_data.get('budget_code_name'),
            unk=validated_data.get('unk'),
            tk_id=validated_data.get('tk_id'),
            year=validated_data.get('year'),
        )

        target_record = existing_bc_qs.first()

        # Сценарий А: Полный дубликат уже активен в системе
        if target_record and target_record.status == PlanItemStatus.ACTIVE:
            return target_record

        # Сценарий Б: Идентичный черновик/пакет ротируется в ACTIVE
        elif target_record and target_record.status == PlanItemStatus.UPLOAD:
            with transaction.atomic():
                BudgetCosts.objects.filter(
                    plan_item=plan_item,
                    status=PlanItemStatus.ACTIVE
                ).update(status=PlanItemStatus.ARCHIVE)

                # Активируем найденный пакет и сохраняем изменения в СУБД
                target_record.status = PlanItemStatus.ACTIVE
                target_record.save(update_fields=['status', 'changed_at'])

            return target_record

        # Сценарий В: Если запись найдена в промежуточных черновиках — уводим в архив
        elif target_record:
            if target_record.status in [PlanItemStatus.DRAFT, PlanItemStatus.DRAFT_ON_REVIEW,
                                        PlanItemStatus.DRAFT_APPROVED, PlanItemStatus.DRAFT_REJECTED]:
                target_record.delete()
                target_record = None

        if 'status' not in validated_data:
            validated_data['status'] = PlanItemStatus.ACTIVE

        return super().create(validated_data)



# =====================================================================
# 2. СЕРИАЛИЗАТОР ОТОБРАЖЕНИЯ (для вывода на фронтенде)
# =====================================================================
class CostDetailResponseSchema(serializers.Serializer):
    total_cost = serializers.DecimalField(max_digits=15, decimal_places=2)
    budget_cost = serializers.DecimalField(max_digits=15, decimal_places=2)
    fund_cost = serializers.DecimalField(max_digits=15, decimal_places=2)
    inner_cost = serializers.DecimalField(max_digits=15, decimal_places=2)

class BudgetCostsForItemSerializer(serializers.ModelSerializer):
    cost_detail = serializers.SerializerMethodField()
    functional_class_detail = FunctionalCodeSerializer(source='functional_class', read_only=True)
    economic_class_detail = ExternalEconomicCodeSerializer(source='economic_class', read_only=True)
    internal_economic_class_detail = InternalEconomicClassifierSerializer(source='internal_economic_class', read_only=True)
    program_class_detail = ProgramCodeSerializer(source='program_class', read_only=True)
    cost_departments = serializers.SerializerMethodField()


    class Meta:
        model = BudgetCosts
        fields = ['status', 'year', 'cost_detail', 'functional_class_detail', 'economic_class_detail',
                  'internal_economic_class_detail',
                  'program_class_detail', 'department_code', 'unk', 'tk_id', 'budget_code', 'budget_code_name',
                  'cost_departments',

                  ]

    @extend_schema_field(CostDetailResponseSchema)
    def get_cost_detail(self, obj):
        fund_cost, inner_cost = Decimal('0.00'), Decimal('0.00')

        if obj.plan_item:
            detail = obj.plan_item.details.filter(status=PlanItemStatus.ACTIVE).first()
            if detail:
                fund_cost = detail.fund_cost
                inner_cost = detail.inner_cost

        budget_cost = Decimal(str(obj.cost)) if obj.cost else Decimal('0.00')
        total_cost = budget_cost + fund_cost + inner_cost

        return {
            "total_cost": total_cost,
            "budget_cost": budget_cost,
            "fund_cost": fund_cost,
            "inner_cost": inner_cost
        }

    def get_cost_departments(self, obj):
        plan_shares = obj.plan_shares.filter(status=PlanItemStatus.ACTIVE)
        return PlanShareForBudgetCustSerializer(plan_shares, many=True, context=self.context).data



class BudgetCostsForShortItemSerializer(serializers.ModelSerializer):
    full_cost = serializers.SerializerMethodField()
    internal_economic_class_detail = InternalEconomicClassifierSerializer(source='internal_economic_class', read_only=True)

    class Meta:
        model = BudgetCosts
        fields = ['id', 'year', 'full_cost', 'functional_code', 'economic_code', 'internal_economic_class_detail']

    @extend_schema_field(serializers.DecimalField(max_digits=15, decimal_places=2))
    def get_full_cost(self, obj):
        if obj.plan_item:
            detail = obj.plan_item.details.filter(status=PlanItemStatus.ACTIVE).first()
            portal_cost = (detail.fund_cost + detail.inner_cost) if detail else Decimal('0.00')
        else:
            portal_cost = Decimal('0.00')

        budget_cost = Decimal(str(obj.cost)) if obj.cost else Decimal('0.00')

        return portal_cost + budget_cost

# =====================================================================
# 3. ЧИСТЫЙ СЕРИАЛИЗАТОР
# =====================================================================
class BudgetCostsSerializer(serializers.ModelSerializer):
    functional_class_detail = FunctionalCodeSerializer(source='functional_class', read_only=True)
    functional_class_code_api = serializers.CharField(source='functional_class.code_api', read_only=True)

    economic_class_detail = ExternalEconomicCodeSerializer(source='economic_class', read_only=True)
    economic_class_code_api = serializers.CharField(source='economic_class.code_api', read_only=True)

    program_class_detail = ProgramCodeSerializer(source='program_class', read_only=True)
    program_class_code_api = serializers.CharField(source='program_class.code_api', read_only=True)

    internal_economic_class_detail = InternalEconomicClassifierSerializer(source='internal_economic_class', read_only=True)
    internal_economic_class_code = serializers.CharField(source='internal_economic_class.code', read_only=True)

    internal_economic_section_detail = InternalEconomicClassifierSerializer(source='internal_economic_section', read_only=True)
    internal_economic_section_code = serializers.CharField(source='internal_economic_section.code', read_only=True)

    internal_economic_subsection_detail = InternalEconomicClassifierSerializer(source='internal_economic_subsection', read_only=True)
    internal_economic_subsection_code = serializers.CharField(source='internal_economic_subsection.code', read_only=True)

    internal_economic_kind_detail = InternalEconomicClassifierSerializer(source='internal_economic_kind', read_only=True)
    internal_economic_kind_code = serializers.CharField(source='internal_economic_kind.code', read_only=True)

    internal_economic_article_detail = InternalEconomicClassifierSerializer(source='internal_economic_article', read_only=True)
    internal_economic_article_code = serializers.CharField(source='internal_economic_article.code', read_only=True)

    aggregated_cost = serializers.SerializerMethodField()

    class Meta:
        model = BudgetCosts
        fields = ['id', 'plan_item', 'status', 'purchases_items_id', 'aggregated_cost', 'cost',
                  # FUNCTIONAL_CODE:
                  'functional_class', 'functional_class_code_api', 'functional_class_detail',
                  'department_code',
                  # ECONOMIC_CODE:
                  'economic_class', 'economic_class_code_api', 'economic_class_detail',
                  # PROGRAM_CODE:
                  'program_class', 'program_class_code_api', 'program_class_detail',
                  'budget_code', 'budget_code_name',
                  'unk', 'tk_id', 'year',

                  'internal_economic_class', 'internal_economic_class_code', 'internal_economic_class_detail',
                  'internal_economic_section', 'internal_economic_section_code', 'internal_economic_section_detail',
                  'internal_economic_subsection', 'internal_economic_subsection_code',
                  'internal_economic_subsection_detail',
                  'internal_economic_kind', 'internal_economic_kind_code', 'internal_economic_kind_detail',
                  'internal_economic_article', 'internal_economic_article_code', 'internal_economic_article_detail',
                  ]

    @extend_schema_field(serializers.DecimalField(max_digits=15, decimal_places=2))
    def get_aggregated_cost(self, obj):
        if obj.plan_item:
            detail = obj.plan_item.details.filter(status=PlanItemStatus.ACTIVE).first()
            portal_cost = (detail.fund_cost + detail.inner_cost) if detail else Decimal('0.00')
        else:
            portal_cost = Decimal('0.00')

        budget_cost = Decimal(str(obj.cost)) if obj.cost else Decimal('0.00')

        return portal_cost + budget_cost


    def update(self, instance, validated_data):
        status = validated_data.pop('status', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if status is None or status == PlanItemStatus.ACTIVE:
            instance.status = PlanItemStatus.DRAFT
        else:
            instance.status = status

        instance.save()

        return instance
