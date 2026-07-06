from rest_framework import serializers
from procurement.models import PlanShare

class PlanShareSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanShare
        fields = ['id', 'status', 'budget_cost', 'department', 'shared_amount', 'shared_cost', 'shared_fund_cost', 'shared_inner_cost' ]