from django.db import models
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny

from core.choices import PlanItemStatus
from procurement.models import Purchases, PlanItem, PlanItemDetail, BudgetCosts
from procurement.serializers import PlanItemSerializer, PlanItemShortSerializer, PlanItemFullSerializer


class PlanItemViewSet(viewsets.ModelViewSet):
    """
    Эндпоинт управления неизменяемыми мастер-записями позиций годового плана ГПЗ.
    Обеспечивает сквозной оперативный контроль лимитов и кассового исполнения обязательств.
    """
    permission_classes = [AllowAny]  # Временный режим отладки системы
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    # search_fields = ['num', 'details__title', 'details__okrb']
    # filterset_fields = ['is_public', 'plan_purchase', 'plan_purchase__year']

    def get_queryset(self):
        """Оптимизируем SQL-запросы в зависимости от действия"""
        queryset = PlanItem.objects.prefetch_related(
            models.Prefetch(
                'details',
                queryset=PlanItemDetail.objects.filter(status=PlanItemStatus.ACTIVE),
                to_attr='active_plan_item_detail_prefetched'
            ),
            models.Prefetch(
                'budget_costs',
                queryset=BudgetCosts.objects.filter(status=PlanItemStatus.ACTIVE),
                to_attr='active_budget_costs_prefetched'
            )
        )

        if not self.request:
            return queryset.all()

        if self.action == 'list':
            params = self.request.query_params

            purchase_id = params.get('purchase', None)

            if purchase_id:
                try:
                    purchase_id = int(str(purchase_id).strip())
                except (ValueError, TypeError):
                    return PlanItem.objects.none()
            else:
                latest_purchase = Purchases.objects.order_by('-id').first()
                if latest_purchase:
                    purchase_id = latest_purchase.id
                else:
                    return PlanItem.objects.none()

            if params.get('is_active', 'true').strip().lower() == 'false':
                return queryset.filter(plan_purchase_id=purchase_id)

            return queryset.filter(plan_purchase_id=purchase_id, is_active=True)

        if self.action == 'retrieve':
            return PlanItem.objects.prefetch_related('details', 'budget_costs')

        return queryset.all()

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PlanItemSerializer

        if self.action == 'list':
            return PlanItemShortSerializer

        return PlanItemFullSerializer

    def paginate_queryset(self, queryset):
        """
        Бизнес-логика UI ГКСЭ: при каскадном выборе позиций внутри формы создания договора
        пагинация отключается параметром ?no_page=true.
        """
        if 'no_page' in self.request.query_params:
            return None
        return super().paginate_queryset(queryset)
