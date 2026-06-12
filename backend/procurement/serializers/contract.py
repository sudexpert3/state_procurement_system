from datetime import datetime

from rest_framework import serializers
from ..models import Contract, ContractItem
from procurement.serializers.procurementMethodDetail import ProcurementMethodDetailSerializer
from procurement.serializers.supplier import SupplierSerializer
from procurement.serializers.treasuryPayment import TreasuryPaymentSerializer


class ContractItemSerializer(serializers.ModelSerializer):
    """Спецификация договора (Детализация списания лимитов подразделений)"""

    class Meta:
        model = ContractItem
        fields = ['id', 'contract', 'plan_share', 'contract_amount', 'contract_cost']


class ContractSerializer(serializers.ModelSerializer):
    """Единый зарегистрированный договор ГКСЭ (Шапка + Аналитика)"""
    # Вложенное отображение объектов для удобства фронтенда в двухпанельном интерфейсе
    supplier_detail = SupplierSerializer(source='supplier', read_only=True)
    procurement_method_detail_info = ProcurementMethodDetailSerializer(source='procurement_method_detail',
                                                                       read_only=True)

    # Спецификация и платежки подтягиваются автоматически через related_name
    items = ContractItemSerializer(many=True, read_only=True)
    payments = TreasuryPaymentSerializer(many=True, read_only=True)

    # ⚠️ КРИТИЧНО ДЛЯ АВТОТИПИЗАЦИИ: Явно указываем drf-spectacular типы динамических свойств @property
    days_remaining = serializers.IntegerField(read_only=True)
    is_urgent_warning = serializers.BooleanField(read_only=True)

    # Поквартальная динамическая аналитика кассового плана (наш алгоритм пересчета остатков)
    quarterly_analytics = serializers.SerializerMethodField()

    class Meta:
        model = Contract
        fields = [
            'id', 'number', 'contract_date', 'supplier', 'supplier_detail',
            'total_cost', 'buyer', 'parent_contract',
            'is_registered_in_treasury', 'payment_terms', 'planned_delivery_date',
            'notice', 'fixed_assets_plan_item', 'procurement_method_detail',
            'procurement_method_detail_info', 'construction_type', 'created_at',
            'items', 'payments', 'days_remaining', 'is_urgent_warning', 'quarterly_analytics'
        ]

    def get_quarterly_analytics(self, obj) -> dict:
        """Интегрирует расчет поквартального прогноза (как в примере с картриджами) в JSON"""
        # Берем текущий год из даты договора для построения сетки
        year = obj.contract_date.year if obj.contract_date else datetime.now().year
        return obj.get_quarterly_analytics(target_year=year)
