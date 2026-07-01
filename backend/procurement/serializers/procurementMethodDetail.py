from rest_framework import serializers
from procurement.models import ProcurementMethodDetail


class ProcurementMethodDetailSerializer(serializers.ModelSerializer):
    """Сериализатор пунктов процедур закупок РБ"""

    class Meta:
        model = ProcurementMethodDetail
        fields = ['id', 'name', 'parent', 'is_active']


class ProcurementMethodTreeSerializer(serializers.ModelSerializer):
    """Сериализатор иерархических пунктов процедур закупок РБ"""
    sub_methods = serializers.SerializerMethodField()

    class Meta:
        model = ProcurementMethodDetail
        fields = ['id', 'name', 'is_active', 'parent', 'sub_methods']

    def get_sub_methods(self, obj):
        """Рекурсивно подтягивает только активные дочерние подразделения"""
        active_subs = obj.sub_methods.filter(is_active=True)
        return ProcurementMethodTreeSerializer(active_subs, many=True, context=self.context).data
