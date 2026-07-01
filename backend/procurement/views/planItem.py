from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny

from procurement.models import PlanItem
from procurement.serializers import PlanItemSerializer, PlanItemShortSerializer, PlanItemFullSerializer


class PlanItemViewSet(viewsets.ModelViewSet):
    """
    Эндпоинт управления неизменяемыми мастер-записями позиций годового плана ГПЗ.
    Обеспечивает сквозной оперативный контроль лимитов и кассового исполнения обязательств.
    """

    permission_classes = [AllowAny]  # Временный режим отладки системы
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['num', 'versions__title', 'versions__okrb']
    filterset_fields = ['is_active', 'is_public', 'purchase', 'purchase__year']

    def get_queryset(self):
        """Оптимизируем SQL-запросы в зависимости от действия"""
        if self.action in ['list', 'retrieve']:
            return PlanItem.objects.all().select_related('purchase').prefetch_related('details', 'budget_costs')
        return PlanItem.objects.all()

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PlanItemSerializer

        if self.action in ['list', 'retrieve']:
            if self.request:
                full_info = self.request.query_params.get('full_info', 'false') == 'true'
                if full_info:
                    return PlanItemFullSerializer

        return PlanItemShortSerializer

    def paginate_queryset(self, queryset):
        """
        Бизнес-логика UI ГКСЭ: при каскадном выборе позиций внутри формы создания договора
        пагинация отключается параметром ?no_page=true.
        """
        if 'no_page' in self.request.query_params:
            return None
        return super().paginate_queryset(queryset)
