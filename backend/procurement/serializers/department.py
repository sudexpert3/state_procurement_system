from rest_framework import serializers
from procurement.models.department import Department


class DepartmentSerializer(serializers.ModelSerializer):
    """Базовый сериализатор для создания, изменения и плоского вывода подразделений"""
    # Вычисляемое свойство модели (@property) явно типизируем для drf-spectacular
    is_root = serializers.BooleanField(read_only=True)

    class Meta:
        model = Department
        fields = ['id', 'full_name', 'short_name', 'is_active', 'parent', 'is_root']


class DepartmentTreeSerializer(serializers.ModelSerializer):
    """Рекурсивный сериализатор для автоматической сборки дерева подразделений ГКСЭ"""
    # Поле sub_departments вызывает само себя (рекурсия) для вывода вложенных филиалов
    sub_departments = serializers.SerializerMethodField()
    is_root = serializers.BooleanField(read_only=True)

    class Meta:
        model = Department
        fields = ['id', 'full_name', 'short_name', 'is_active', 'is_root', 'sub_departments']

    def get_sub_departments(self, obj):
        """Рекурсивно подтягивает только активные дочерние подразделения"""
        active_subs = obj.sub_departments.filter(is_active=True)
        return DepartmentTreeSerializer(active_subs, many=True, context=self.context).data
