from rest_framework import serializers
from procurement.models import ProcurementMethodDetail


class ProcurementMethodDetailSerializer(serializers.ModelSerializer):
    """Сериализатор иерархических пунктов процедур закупок РБ"""

    class Meta:
        model = ProcurementMethodDetail
        fields = ['id', 'name', 'parent', 'is_active']
