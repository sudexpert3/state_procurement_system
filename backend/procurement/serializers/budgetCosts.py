from rest_framework import serializers
from models import FunctionalCode, ProgramCode, BudgetCosts, ExternalEconomicCode



class BudgetCostsSerializer(serializers.ModelSerializer):
    # Принимаем сырые текстовые строки из внешнего API
    functional_code = serializers.CharField(write_only=True, required=False)
    program_code = serializers.CharField(write_only=True, required=False)
    economic_code = serializers.CharField(write_only=True, required=False)  # Принимает строку с пробелами ("1 10 05 0")

    class Meta:
        model = BudgetCosts
        fields = [
            "purchases_items_id",
            "year",
            "cost",
            "functional_code",
            "program_code",
            "budget_code",
            "budget_code_name",
        ]

    def validate(self, attrs):
        # 1. Извлекаем прилетевшие внешние коды
        raw_func_code = attrs.pop("functional_code", None)
        raw_prog_code = attrs.pop("program_code", None)
        raw_econ_code = attrs.pop("economic_code").strip()

        # 2. Обработка функционального кода
        if raw_func_code:
            func_obj = FunctionalCode.objects.filter(code_api=raw_func_code.strip()).first()
            if not func_obj:
                func_obj = FunctionalCode.objects.create(
                    code_api=raw_func_code.strip(),
                    description=f"Новый код из API: {raw_func_code}",
                )
            attrs["functional_class"] = func_obj

        # 3. Обработка программного кода
        if raw_prog_code:
            # Чистим строку: например, "19 01" на goszakupki.by может прилетать как "19 1"
            clean_prog_code = raw_prog_code.strip()

            prog_obj = ProgramCode.objects.filter(code_api=clean_prog_code).first()
            if not prog_obj:
                prog_obj = ProgramCode.objects.create(
                    code_api=clean_prog_code,
                    description=f"Программа {clean_prog_code}",
                )
            attrs["program_class"] = prog_obj

        if raw_econ_code:
            clean_econ_code = raw_econ_code.strip()

            econ_obj = ExternalEconomicCode.objects.filter(code_api=clean_econ_code).first()
            if not econ_obj:
                econ_obj = ExternalEconomicCode.objects.create(
                    code_api=clean_econ_code,
                    description=f"Новый код {clean_econ_code}",
                )
            attrs["external_economic_class"] = econ_obj

        return attrs
