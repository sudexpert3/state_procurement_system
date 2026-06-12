from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend

from procurement.models.department import Department
from procurement.serializers.department import DepartmentSerializer, DepartmentTreeSerializer


class DepartmentViewSet(viewsets.ModelViewSet):
    """
    Эндпоинт управления и вывода иерархического справочника подразделений ГКСЭ РБ.
    Поддерживает плоский вывод, сквозной текстовый поиск и древовидную сборку структуры.
    """
    queryset = Department.objects.filter(is_active=True).select_related('parent')
    permission_classes = [AllowAny]  # Временный режим локальной отладки без авторизации
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    pagination_class = None
    search_fields = ['short_name', 'full_name']
    filterset_fields = ['parent', 'is_active']

    def get_serializer_class(self):
        """
        Динамический выбор сериализатора.
        Если в GET-запросе передан флаг ?tree=true, бэкенд возвращает вложенное дерево.
        """
        if self.request.query_params.get('tree') == 'true':
            return DepartmentTreeSerializer
        return DepartmentSerializer

    def get_queryset(self):
        """
        Оптимизация базы данных: если запрашивается дерево, то выбираются
        только корневые элементы (parent=None), чтобы избежать дублирования веток.
        """
        queryset = super().get_queryset()
        if self.request.query_params.get('tree') == 'true':
            return queryset.filter(parent__isnull=True).prefetch_related('sub_departments')
        return queryset

