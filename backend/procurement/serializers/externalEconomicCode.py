from rest_framework import serializers
from procurement.models import ExternalEconomicCode


class ExternalEconomicCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExternalEconomicCode
        fields = ['id', 'code_api', 'description', 'is_active', ]
