from rest_framework import serializers
from procurement.models import PlanShare
from .department import DepartmentSerializer

class PlanShareSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanShare
        fields = ['id', 'status', 'budget_cost', 'department', 'shared_amount', 'shared_cost', 'shared_fund_cost', 'shared_inner_cost' ]



class PlanShareForBudgetCustSerializer(serializers.ModelSerializer):
    department_detail = DepartmentSerializer(source='department', read_only=True)
    class Meta:
        model = PlanShare
        fields = ['id', 'status', 'department_detail', 'shared_amount', 'shared_cost', 'shared_fund_cost', 'shared_inner_cost' ]
