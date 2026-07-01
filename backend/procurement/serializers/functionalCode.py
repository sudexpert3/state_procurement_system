from rest_framework import serializers
from procurement.models import FunctionalCode


class FunctionalCodeSerializer(serializers.ModelSerializer):
    """
    Сериализатор справочника функциональной классификации расходов Минфина РБ.
    """
    class Meta:
        model = FunctionalCode
        fields = ['id', 'code_api', 'description', 'is_active',]

