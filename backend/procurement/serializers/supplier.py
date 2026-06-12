from rest_framework import serializers
from procurement.models import Supplier


class SupplierSerializer(serializers.ModelSerializer):
    """Сериализатор контрагентов (ЕАЭС: УНП/ИНН)"""

    class Meta:
        model = Supplier
        fields = ['id', 'name', 'unp']
