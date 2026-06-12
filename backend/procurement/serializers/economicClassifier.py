from rest_framework import serializers
from procurement.models.economicClassifier import EconomicClassifier


class EconomicClassifierSerializer(serializers.ModelSerializer):
    """Базовый плоский сериализатор для создания, изменения и поиска статей ЭКР"""
    class Meta:
        model = EconomicClassifier
        fields = ['id', 'code', 'name', 'parent']


class EconomicClassifierTreeSerializer(serializers.ModelSerializer):
    """Рекурсивный сериализатор для автоматической сборки дерева ЭКР Минфина РБ"""
    # Поле sub_codes вызывает само себя (рекурсия) для вывода вложенных подстатей
    sub_codes = serializers.SerializerMethodField()

    class Meta:
        model = EconomicClassifier
        fields = ['id', 'code', 'name', 'sub_codes']

    def get_sub_codes(self, obj):
        """Рекурсивно подтягивает вложенные статьи ЭКР следующего уровня"""
        child_codes = obj.sub_codes.all()
        return EconomicClassifierTreeSerializer(child_codes, many=True, context=self.context).data
