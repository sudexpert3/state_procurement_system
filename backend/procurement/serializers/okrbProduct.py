from rest_framework import serializers
from procurement.models import OkrbProduct


class OkrbProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = OkrbProduct
        fields = ['id', 'code', 'title', 'is_active']
