from rest_framework import serializers
from ..models import FunctionalCode, ProgramCode, BudgetCosts, ExternalEconomicCode


# =====================================================================
# 1. СЕРИАЛИЗАТОР ИМПОРТА (для парсинга goszakupki.by)
# =====================================================================
class BudgetCostsImportSerializer(serializers.ModelSerializer):
    """Используется ТОЛЬКО для POST-запросов импорта 'сырых' данных извне"""
    functional_code = serializers.CharField(write_only=True, required=False)
    program_code = serializers.CharField(write_only=True, required=False)
    economic_code = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = BudgetCosts
        fields = [
            "purchases_items_id", "year", "cost", "functional_code",
            "program_code", "economic_code", "budget_code", "budget_code_name",
            "department_code", "unk", "tk_id", "economic_class"
        ]

    def validate(self, attrs):
        raw_func_code = attrs.pop("functional_code", None)
        raw_prog_code = attrs.pop("program_code", None)
        raw_econ_code = attrs.pop("economic_code", None)

        if raw_func_code:
            func_obj, _ = FunctionalCode.objects.get_or_create(
                code_api=raw_func_code.strip(),
                defaults={"description": f"Новый код из API: {raw_func_code}"}
            )
            attrs["functional_class"] = func_obj

        if raw_prog_code:
            clean_prog_code = raw_prog_code.strip()
            prog_obj, _ = ProgramCode.objects.get_or_create(
                code_api=clean_prog_code,
                defaults={"description": f"Программа {clean_prog_code}"}
            )
            attrs["program_class"] = prog_obj

        if raw_econ_code:
            clean_econ_code = raw_econ_code.strip()
            econ_obj, _ = ExternalEconomicCode.objects.get_or_create(
                code_api=clean_econ_code,
                defaults={"description": f"Новый код {clean_econ_code}"}
            )
            attrs["external_economic_class"] = econ_obj

        return attrs


# =====================================================================
# 2. СЕРИАЛИЗАТОР ОТОБРАЖЕНИЯ (для вывода на фронтенде)
# =====================================================================
class BudgetCostsAnalyticSerializer(serializers.ModelSerializer):
    """Используется ТОЛЬКО для GET-запросов отрисовки таблиц ГКСЭ на фронтенде"""
    economic_class_code = serializers.CharField(source='economic_class.code', read_only=True)
    economic_class_name = serializers.CharField(source='economic_class.name', read_only=True)

    economic_section_code = serializers.CharField(source='economic_section.code', read_only=True)
    economic_subsection_code = serializers.CharField(source='economic_subsection.code', read_only=True)
    economic_kind_code = serializers.CharField(source='economic_kind.code', read_only=True)
    economic_article_code = serializers.CharField(source='economic_article.code', read_only=True)

    root_department_cost = serializers.SerializerMethodField()

    class Meta:
        model = BudgetCosts
        fields = [
            'id', 'plan_version', 'purchases_items_id', 'year', 'cost',
            'functional_class', 'external_economic_class', 'program_class',
            'department_code', 'budget_code', 'budget_code_name', 'unk', 'tk_id',
            'economic_class', 'economic_class_code', 'economic_class_name',
            'economic_section', 'economic_section_code',
            'economic_subsection', 'economic_subsection_code',
            'economic_kind', 'economic_kind_code',
            'economic_article', 'economic_article_code',
            'root_department_cost'
        ]

    def get_root_department_cost(self, obj) -> float:
        request = self.context.get('request')
        if request and 'root_dep_id' in request.query_params:
            try:
                dep_id = int(request.query_params.get('root_dep_id'))
                return float(obj.get_total_cost_for_root_department(dep_id))
            except (ValueError, TypeError):
                return 0
        return 0