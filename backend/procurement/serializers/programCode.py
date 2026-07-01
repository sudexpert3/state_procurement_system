from rest_framework import serializers
from procurement.models import ProgramCode


class ProgramCodeSerializer(serializers.ModelSerializer):
    """
    Сериализатор справочника функциональной классификации расходов Минфина РБ.
    """
    class Meta:
        model = ProgramCode
        fields = ['id', 'code_api', 'description', 'is_active',]
