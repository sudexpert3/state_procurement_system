from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.choices import ChangeRequestKind
from procurement.models import ChangeRequest, PlanItem
from procurement.serializers import (
    ChangeRequestSerializer, ChangeRequestCreateSerializer, RejectSerializer,
    RedistributionCreateSerializer, DepartmentLimitCalibrationCreateSerializer,
)
from procurement.services import change_requests as cr_service


class ChangeRequestViewSet(viewsets.ModelViewSet):
    """
    Общий движок одобрения изменений (Этап 2) — заявки на изменение/исключение позиции
    плана (и в будущем, Этап 3.4 — на корректировку лимита от Казначейства) проходят через
    один и тот же статусный цикл DRAFT -> ON_REVIEW -> APPROVED/REJECTED.

    POST /change_requests/            — создать (plan_item, kind, reason)
    POST /change_requests/{id}/submit/   — отправить черновик на проверку
    POST /change_requests/{id}/approve/  — одобрить
    POST /change_requests/{id}/reject/   — отклонить (body: rejection_reason)
    GET  /change_requests/{id}/forecast/ — прогноз последствий (read-only)
    """
    queryset = ChangeRequest.objects.select_related('plan_item').all()
    serializer_class = ChangeRequestSerializer
    permission_classes = [AllowAny]  # как и весь остальной API — авторизация отложена (Этап 7)
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'kind', 'plan_item']

    def create(self, request, *args, **kwargs):
        serializer = ChangeRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        plan_item = get_object_or_404(PlanItem, pk=data['plan_item'])

        try:
            change_request = cr_service.create_change_request(
                plan_item=plan_item, kind=data['kind'], reason=data['reason'],
            )
        except (DjangoValidationError, NotImplementedError) as exc:
            return Response({'detail': _error_message(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(ChangeRequestSerializer(change_request).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def redistribute(self, request):
        """Создать заявку на перераспределение лимита (kind=LIMIT_REDISTRIBUTION) —
        отдельная точка входа, т.к. форма черновика иная (набор строк BudgetQuarterlyLimit,
        не клон позиции плана). Дальше — те же submit/approve/reject/forecast, что у любой
        другой заявки."""
        serializer = RedistributionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            change_request = cr_service.create_redistribution(data['lines'], reason=data['reason'])
        except DjangoValidationError as exc:
            return Response({'detail': _error_message(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ChangeRequestSerializer(change_request).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def calibrate_department_limits(self, request):
        """Создать заявку на калибровку разбивки статьи Минфина на подстатьи/держателей
        лимита (kind=DEPARTMENT_LIMIT_CALIBRATION) — клонирует текущие ACTIVE строки
        DepartmentArticleLimit этой статьи/года в черновик (см. cr_service.
        create_department_limit_calibration). Дальше специалист правит строки через
        /api/department_article_limits/ (change_request=этой заявки, status=DRAFT),
        смотрит сверку через forecast/ и одобряет — как любую другую заявку."""
        serializer = DepartmentLimitCalibrationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            change_request = cr_service.create_department_limit_calibration(
                functional_class_id=data['functional_class'], economic_class_id=data['economic_class'],
                year=data['year'], reason=data['reason'],
            )
        except DjangoValidationError as exc:
            return Response({'detail': _error_message(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ChangeRequestSerializer(change_request).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        change_request = self.get_object()
        try:
            cr_service.submit(change_request)
        except DjangoValidationError as exc:
            return Response({'detail': _error_message(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ChangeRequestSerializer(change_request).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        change_request = self.get_object()
        try:
            cr_service.approve(change_request)
        except DjangoValidationError as exc:
            return Response({'detail': _error_message(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ChangeRequestSerializer(change_request).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        change_request = self.get_object()
        serializer = RejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            cr_service.reject(change_request, serializer.validated_data['rejection_reason'])
        except DjangoValidationError as exc:
            return Response({'detail': _error_message(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ChangeRequestSerializer(change_request).data)

    @action(detail=True, methods=['get'])
    def forecast(self, request, pk=None):
        change_request = self.get_object()
        return Response(cr_service.compute_forecast(change_request))


def _error_message(exc):
    if isinstance(exc, DjangoValidationError):
        return exc.messages[0] if exc.messages else str(exc)
    return str(exc)
