from rest_framework import serializers
from django.db import transaction
from procurement.models import Plan, PlanVersion, BudgetCosts, OkrbProduct, UnitOfMeasurement
from .budgetCosts import BudgetCostsSerializer


class PlanImportSerializer(serializers.ModelSerializer):
    """Входной сериализатор для первоначального создания планов через внешний JSON"""
    budget_costs = BudgetCostsSerializer(many=True)

    class Meta:
        model = PlanVersion
        fields = [
            'plan_goszakupki_id', 'purchases_id', 'unp_budget', 'num',
            'title', 'okrb', 'okrb_title', 'type', 'val_amount',
            'val_type', 'fund_cost', 'inner_cost', 'val_currency',
            'procedure_months', 'is_by_organizator', 'budget_costs'
        ]

    def create(self, validated_data):
        budget_costs_data = validated_data.pop('budget_costs')
        num = validated_data.get('num')

        # Запускаем создание в атомарной транзакции базы данных
        with transaction.atomic():
            # 1. Создаем или находим Мастер-запись плана по уникальному номеру (num)
            plan_master, created = Plan.objects.get_or_create(
                num=num,
                defaults={'status': 'APPROVED'}  # Первичный импорт по API сразу утвержден
            )

            # 2. Если мастер-запись уже была, деактивируем прошлые версии
            if not created:
                PlanVersion.objects.filter(plan=plan_master, is_active=True).update(is_active=False)

            # 3. Создаем новый активный снимок (Версию 1)
            plan_version = PlanVersion.objects.create(plan=plan_master, version_number=1, is_active=True, **validated_data)

            # 4. Раскладываем дочерний массив расходов с учетом нового поля 'economic_class'
            for cost_data in budget_costs_data:
                BudgetCosts.objects.create(plan_version=plan_version, **cost_data)

        return plan_version

    def validate(self, attrs):
        raw_okrb = attrs.get("okrb", None).strip()
        raw_okrb_title = attrs.get("okrb_title", None).strip()

        if raw_okrb:
            # Ищем код в нашем новом справочнике
            okrb_obj = OkrbProduct.objects.filter(code=raw_okrb).first()

            if not okrb_obj and raw_okrb_title:
                # Если в закупке прилетел редкий код, которого еще нет в справочнике,
                # создаем его автоматически, чтобы импорт не падал
                okrb_obj = OkrbProduct.objects.create(code=raw_okrb, title=raw_okrb_title)

            attrs["okrb_product"] = okrb_obj

        raw_val_type = attrs.get("val_type", None).strip()
        if raw_val_type:
            unit_obj = UnitOfMeasurement.objects.filter(code=raw_val_type).first()

            if not unit_obj:
                # Защитный фолбек: если Минфин прислал редкий новый код единицы измерения,
                # создаем его автоматически, чтобы закупка не падала
                unit_obj = UnitOfMeasurement.objects.create(
                    code=raw_val_type,
                    short_name=f"Код {raw_val_type}",
                )

            attrs["val_unit"] = unit_obj

        return attrs