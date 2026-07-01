from rest_framework import serializers
from procurement.models.internalEconomicClassifier import InternalEconomicClassifier


class InternalEconomicClassifierSerializer(serializers.ModelSerializer):
    """Базовый плоский сериализатор для создания, изменения и поиска статей ЭКР"""
    class Meta:
        model = InternalEconomicClassifier
        fields = ['id', 'code', 'name', 'is_active', 'parent']


class InternalEconomicClassifierTreeSerializer(serializers.ModelSerializer):
    """Рекурсивный сериализатор для автоматической сборки дерева ЭКР Минфина РБ"""
    # Поле sub_codes вызывает само себя (рекурсия) для вывода вложенных подстатей
    sub_codes = serializers.SerializerMethodField()

    class Meta:
        model = InternalEconomicClassifier
        fields = ['id', 'code', 'name', 'is_active', 'sub_codes']

    def get_sub_codes(self, obj):
        """Рекурсивно подтягивает вложенные статьи ЭКР следующего уровня"""
        child_codes = obj.sub_codes.filter(is_active=True)
        return InternalEconomicClassifierTreeSerializer(child_codes, many=True, context=self.context).data
