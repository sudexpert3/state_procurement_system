from rest_framework import serializers
from procurement.models import UnitOfMeasurement


class UnitOfMeasurementSerializer(serializers.ModelSerializer):
    """Обновленный сериализатор единиц измерения под актуальную модель"""

    class Meta:
        model = UnitOfMeasurement
        fields = ['id', 'code', 'short_name', 'is_active']
