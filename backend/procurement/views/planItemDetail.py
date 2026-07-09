from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny

from procurement.models import PlanItemDetail
from procurement.serializers import PlanItemDetailSerializer


class PlanItemDetailViewSet(viewsets.ModelViewSet):
    """
    Эндпоинт управления неизменяемыми мастер-записями позиций годового плана ГПЗ.
    Обеспечивает сквозной оперативный контроль лимитов и кассового исполнения обязательств.
    """
    serializer_class = PlanItemDetailSerializer
    permission_classes = [AllowAny]  # Временный режим отладки системы
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]

    def get_queryset(self):
        """Оптимизируем SQL-запросы в зависимости от действия"""
        if self.action in ['list', 'retrieve']:
            return PlanItemDetail.objects.all().select_related('plan_item').prefetch_related('okrb_product', 'val_unit')
        return PlanItemDetail.objects.all()

    def paginate_queryset(self, queryset):
        """
        Бизнес-логика UI ГКСЭ: при каскадном выборе позиций внутри формы создания договора
        пагинация отключается параметром ?no_page=true.
        """
        if 'no_page' in self.request.query_params:
            return None
        return super().paginate_queryset(queryset)
