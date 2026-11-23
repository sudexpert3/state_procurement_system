from django.core.exceptions import ValidationError as DjangoValidationError
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.choices import PlanItemStatus
from procurement.models import ArticleQuarterlyAllocation, DepartmentArticleLimit
from procurement.permissions import has_capability
from procurement.serializers import (
    DepartmentArticleLimitSerializer, ArticleAvailabilitySerializer, OverspendSummaryLineSerializer,
)
from procurement.services import department_limits as dl_service


class DepartmentArticleLimitViewSet(viewsets.ModelViewSet):
    """Страница «Распределение лимитов» (решение пользователя 2026-11-23) — прямой CRUD,
    без согласования через ChangeRequest: доступ и так ограничен ролью (финансист/админ,
    см. get_permissions()). Черновик (status=DRAFT) редактируется и удаляется свободно;
    ACTIVE/ARCHIVE — только `note`/`deactivated_at` (см. DepartmentArticleLimitSerializer.
    validate()). Перевод в ACTIVE — через action `activate`, не через PATCH статуса.

    GET  /department_article_limits/                     — список (фильтры ниже)
    POST /department_article_limits/                      — создать черновик
    PATCH/DELETE .../{id}/                                 — править/удалить черновик
    POST .../{id}/activate/                                — DRAFT -> ACTIVE, архивирует
                                                              прежнюю версию этой же связки
    GET  .../article_availability/?functional_class=&economic_class=&year=&exclude=<id>
                                                            — для живого предупреждения в модалке
    GET  .../overspend_summary/?year=                     — для баннера перерасхода на странице
    """
    queryset = DepartmentArticleLimit.objects.all().select_related(
        'functional_class', 'economic_class', 'internal_economic_class', 'department',
    )
    serializer_class = DepartmentArticleLimitSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'functional_class', 'economic_class', 'internal_economic_class', 'department', 'year']

    def get_permissions(self):
        return [has_capability('department_limits')()]

    def list(self, request, *args, **kwargs):
        """Переопределён, чтобы считать `plan_amount`/`paid_amount` ОДНИМ проходом на всю
        страницу выдачи, а не отдельным запросом на каждую строку (см. docstring
        DepartmentArticleLimitSerializer.get_plan_amount/get_paid_amount)."""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        objects = page if page is not None else queryset
        keys = {(o.internal_economic_class_id, o.department_id, o.year) for o in objects}

        plan_amount_map = {key: dl_service.compute_reserved_by_plan_share(*key) for key in keys}
        paid_amount_map = {key: dl_service.compute_paid_actual_by_department(*key) for key in keys}
        context = self.get_serializer_context()
        context['plan_amount_map'] = plan_amount_map
        context['paid_amount_map'] = paid_amount_map

        serializer = self.get_serializer(objects, many=True, context=context)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != PlanItemStatus.DRAFT:
            return Response(
                {'detail': 'Удалить можно только черновик.'}, status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @extend_schema(request=None, responses=DepartmentArticleLimitSerializer)
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        instance = self.get_object()
        try:
            dl_service.activate_limit(instance)
        except DjangoValidationError as exc:
            return Response({'detail': _error_message(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(DepartmentArticleLimitSerializer(instance).data)

    @extend_schema(responses=ArticleAvailabilitySerializer)
    @action(detail=False, methods=['get'])
    def article_availability(self, request):
        """Для живого предупреждения в модалке создания/редактирования — не блокирует,
        только отдаёт цифры (перерасход разрешён, решение пользователя 2026-11-23)."""
        functional_class = int(request.query_params['functional_class'])
        economic_class = int(request.query_params['economic_class'])
        year = int(request.query_params['year'])
        exclude_id = request.query_params.get('exclude')

        available_limit = dl_service.compute_available_statya_limit(functional_class, economic_class, year)
        allocated_total = dl_service.compute_allocated_statya_total(
            functional_class, economic_class, year,
            exclude_id=int(exclude_id) if exclude_id else None,
        )
        return Response(ArticleAvailabilitySerializer({
            'functional_class': functional_class, 'economic_class': economic_class, 'year': year,
            'available_limit': available_limit, 'allocated_total': allocated_total,
            'remaining': available_limit - allocated_total,
        }).data)

    @extend_schema(responses=OverspendSummaryLineSerializer(many=True))
    @action(detail=False, methods=['get'])
    def overspend_summary(self, request):
        """Баннер «по такой-то статье — перебор» на странице «Распределение лимитов»."""
        year = int(request.query_params['year'])

        articles = ArticleQuarterlyAllocation.objects.filter(
            year=year, status=PlanItemStatus.ACTIVE,
        ).order_by().values('functional_class_id', 'economic_class_id').distinct()

        lines = []
        for a in articles:
            functional_class_id, economic_class_id = a['functional_class_id'], a['economic_class_id']
            available_limit = dl_service.compute_available_statya_limit(functional_class_id, economic_class_id, year)
            allocated_total = dl_service.compute_allocated_statya_total(functional_class_id, economic_class_id, year)
            overspend_amount = allocated_total - available_limit
            if overspend_amount <= 0:
                continue
            sample = ArticleQuarterlyAllocation.objects.filter(
                functional_class_id=functional_class_id, economic_class_id=economic_class_id,
                year=year, status=PlanItemStatus.ACTIVE,
            ).select_related('functional_class', 'economic_class').first()
            lines.append({
                'functional_class': functional_class_id,
                'functional_code': sample.functional_class.code_api if sample else None,
                'economic_class': economic_class_id,
                'economic_code': sample.economic_class.code_api if sample else None,
                'year': year,
                'available_limit': available_limit,
                'allocated_total': allocated_total,
                'overspend_amount': overspend_amount,
            })
        return Response(OverspendSummaryLineSerializer(lines, many=True).data)


def _error_message(exc):
    if isinstance(exc, DjangoValidationError):
        return exc.messages[0] if exc.messages else str(exc)
    return str(exc)
