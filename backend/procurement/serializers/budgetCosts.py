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

    # Поля, которые реально описывают "ту же строку финансирования" (принадлежность
    # позиции плана + год + источник бюджета). cost и прочие "сырые" атрибуты из API
    # НЕ входят в идентичность — это именно то, что может измениться при пересмотре
    # бюджета на портале и должно ОБНОВИТЬ существующую запись, а не породить новую.
    _MUTABLE_FIELDS = (
        'purchases_items_id', 'cost', 'functional_code', 'department_code',
        'program_code', 'budget_code_name', 'unk', 'tk_id',
        'functional_class', 'program_class',
    )

    # Поля "ручной" классификации ГКСЭ (см. import_reestr26.py) — портал о них не знает,
    # при версионировании их нужно перенести со старого снимка на новый, иначе каждая
    # смена cost на портале обнуляла бы уже проставленный код ЭКР.
    _MANUAL_CLASSIFICATION_FIELDS = (
        'internal_economic_class', 'internal_economic_section',
        'internal_economic_subsection', 'internal_economic_kind', 'internal_economic_article',
    )

    def create(self, validated_data):
        """Версионирование по образцу PlanItem/PlanItemDetail (см. CurrentStatus.md, решение
        от 2026-10-28): сопоставление по СТАБИЛЬНОМУ ключу (позиция плана + год + источник
        бюджета budget_code + статья ЭКР economic_code). Если значения совпали — это просто
        повтор синхронизации, запись не трогаем. Если разошлись — старый снимок уходит в
        ARCHIVE (неизменным, как есть — это и есть история), создаётся НОВЫЙ снимок со
        статусом ACTIVE.

        Было (баг, найден 2026-10-27, исправлен черновым патчем в тот же день, затем
        переделан на версионирование 2026-10-28): в критерий поиска "уже существующей"
        записи входил и `cost` — из-за этого при пересмотре суммы на портале между
        синхронизациями (напр. 1100000 -> 1400000 для 2026-102377498-62) старая запись
        никогда не находилась, создавалась новая, а старая зависала сиротой (252 случая
        по плану 2026 года, подчищены разовой командой dedupe_budget_costs — к сожалению,
        удалением, а не архивацией, см. CurrentStatus.md). Первая версия фикса просто
        перезаписывала cost поверх старой записи — тоже неверно: уничтожала историю.

        Второй баг того же рода (найден 2026-10-29, при разборе q_fin.txt/answer_fin.txt):
        ключ `(plan_item, year, budget_code)` без `economic_code` был ещё слишком грубым —
        одна позиция плана может законно иметь НЕСКОЛЬКО строк бюджета на один год (многолетняя
        закупка с разбивкой по годам — это `year`, но ТАКЖЕ оплата по разным статьям ЭКР за
        разные части одной закупки в ОДНОМ году — см. API `budget_costs: [...]`, список, а не
        одна запись). При синхронизации список обрабатывается `many=True` последовательно —
        вторая строка с ДРУГИМ `economic_code` того же (plan_item, year, budget_code) находила
        первую как "предыдущую версию той же строки" и архивировала её, хотя это отдельная,
        одновременно действующая строка бюджета. Подтверждено на реальных данных (2026-102377498-15/
        -67/-144 и ещё 13 аналогичных случаев по всей БД, см. CurrentStatus.md, Проход 10) —
        исправлено добавлением `economic_code` в ключ идентичности; восстановление уже
        испорченных записей — отдельной командой `reactivate_split_budget_costs`.
        """
        plan_item = validated_data.get('plan_item')

        existing_bc_qs = BudgetCosts.objects.filter(
            plan_item=plan_item,
            year=validated_data.get('year'),
            budget_code=validated_data.get('budget_code'),
            economic_code=validated_data.get('economic_code'),
        )

        target_record = existing_bc_qs.filter(status=PlanItemStatus.ACTIVE).first()

        if target_record:
            changed = any(
                field in validated_data and getattr(target_record, field) != validated_data[field]
                for field in self._MUTABLE_FIELDS
            )
            # Сценарий А: полный повтор синхронизации — ничего не изменилось, запись не трогаем.
            if not changed:
                return target_record

            # Сценарий А2: значения разошлись — версионируем: старый снимок в архив (как есть,
            # это и есть история), новый снимок — ACTIVE, с переносом ручной классификации ЭКР.
            with transaction.atomic():
                target_record.status = PlanItemStatus.ARCHIVE
                target_record.save(update_fields=['status', 'changed_at'])

                new_data = dict(validated_data)
                new_data['status'] = PlanItemStatus.ACTIVE
                for field in self._MANUAL_CLASSIFICATION_FIELDS:
                    new_data.setdefault(field, getattr(target_record, field))
                new_record = BudgetCosts.objects.create(**new_data)

            return new_record

        # Сценарий Б: идентичный черновик/пакет ротируется в ACTIVE
        target_record = existing_bc_qs.filter(status=PlanItemStatus.UPLOAD).first()
        if target_record:
            with transaction.atomic():
                BudgetCosts.objects.filter(
                    plan_item=plan_item,
                    status=PlanItemStatus.ACTIVE
                ).update(status=PlanItemStatus.ARCHIVE)

                for field in self._MUTABLE_FIELDS:
                    if field in validated_data:
                        setattr(target_record, field, validated_data[field])
                target_record.status = PlanItemStatus.ACTIVE
                target_record.save()

            return target_record

        # Сценарий В: запись найдена в промежуточных черновиках — уводим в архив
        target_record = existing_bc_qs.exclude(
            status__in=[PlanItemStatus.ACTIVE, PlanItemStatus.UPLOAD]
        ).first()
        if target_record and target_record.status in [
            PlanItemStatus.DRAFT, PlanItemStatus.DRAFT_ON_REVIEW,
            PlanItemStatus.DRAFT_APPROVED, PlanItemStatus.DRAFT_REJECTED,
        ]:
            target_record.delete()

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
        fields = ['id', 'status', 'year', 'cost_detail', 'functional_class_detail', 'economic_class_detail',
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
        fields = ['id', 'plan_item', 'status', 'change_request', 'purchases_items_id', 'aggregated_cost', 'cost',
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
