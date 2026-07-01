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
        Динамический выбор сериализатора. По умолчанию возвращает сериализатор вложенного дерева.
        Если в GET-запросе передан флаг ?list=true, бэкенд возвращает плоский список подразделений.
        """
        if self.request.query_params.get('list', 'false') == 'true':
            return DepartmentSerializer
        return DepartmentTreeSerializer

    def get_queryset(self):
        if not self.request:
            return super().get_queryset()

        is_flat_list = self.request.query_params.get('list', 'false').lower() == 'true'
        if is_flat_list:
            return super().get_queryset()

        return Department.objects.filter(is_active=True, parent__isnull=True).prefetch_related('sub_departments')
