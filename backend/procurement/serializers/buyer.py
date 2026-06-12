from rest_framework import serializers

from procurement.models import Buyer

class BuyerSerializer(serializers.ModelSerializer):
    """Сериализатор для справочника работников-закупщиков ГКСЭ"""
    class Meta:
        model = Buyer
        fields = ['id', 'shot_name', 'full_name', 'is_active']