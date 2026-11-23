import os
import tempfile

from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, PolymorphicProxySerializer
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.choices import ChangeRequestKind
from procurement.models import ChangeRequest, PlanItem
from procurement.permissions import has_capability
from procurement.serializers import (
    ChangeRequestSerializer, ChangeRequestCreateSerializer, RejectSerializer,
    RedistributionCreateSerializer,
    BudgetLimitCorrectionCreateSerializer,
    PlanItemChangeForecastSerializer, PlanItemExclusionForecastSerializer,
    RedistributionForecastSerializer, BudgetLimitCorrectionForecastSerializer,
    BudgetLimitCorrectionPreviewRequestSerializer, BudgetLimitCorrectionPreviewResponseSerializer,
)
from procurement.services import change_requests as cr_service
from procurement.services import fin_file_parser

# forecast() отдаёт одну из 5 разных форм ответа в зависимости от ChangeRequest.kind (см.
# services/change_requests.py::compute_forecast docstring) — без этой аннотации
# drf-spectacular молча подставлял бы serializer_class вьюсета (ChangeRequestSerializer),
# что было прямой ложью в сгенерированной схеме/типах (найдено фронтендом 2026-11-04).
_FORECAST_RESPONSE = PolymorphicProxySerializer(
    component_name='ChangeRequestForecast',
    resource_type_field_name='kind',
    serializers={
        ChangeRequestKind.PLAN_ITEM_CHANGE.value: PlanItemChangeForecastSerializer,
        ChangeRequestKind.PLAN_ITEM_EXCLUSION.value: PlanItemExclusionForecastSerializer,
        ChangeRequestKind.LIMIT_REDISTRIBUTION.value: RedistributionForecastSerializer,
        ChangeRequestKind.BUDGET_LIMIT_CORRECTION.value: BudgetLimitCorrectionForecastSerializer,
    },
)


class ChangeRequestViewSet(viewsets.ModelViewSet):
    """
    Общий движок одобрения изменений (Этап 2) — заявки на изменение/исключение позиции
    плана (и в будущем, Этап 3.4 — на корректировку лимита от Казначейства) проходят через
    один и тот же статусный цикл DRAFT -> ON_REVIEW -> APPROVED/REJECTED.

    POST   /change_requests/            — создать (plan_item, kind, reason)
    DELETE /change_requests/{id}/        — удалить черновик (только status=DRAFT, см. destroy())
    POST   /change_requests/{id}/submit/   — отправить черновик на проверку
    POST   /change_requests/{id}/approve/  — одобрить
    POST   /change_requests/{id}/reject/   — отклонить (body: rejection_reason)
    GET    /change_requests/{id}/forecast/ — прогноз последствий (read-only)

    Импорт корректировки лимитов (budget_limit_correction_preview/budget_limit_correction) —
    единственная пара действий этого вьюсета с реальным ограничением доступа (решение
    пользователя 2026-11-20): только роль "Финансист"/"Главный администратор", см.
    get_permissions() и procurement/permissions.py::CAPABILITIES['budget_limit_correction'].
    Остальные действия — AllowAny, как и весь остальной API (авторизация отложена, Этап 7).
    """
    queryset = ChangeRequest.objects.select_related('plan_item').all()
    serializer_class = ChangeRequestSerializer
    permission_classes = [AllowAny]  # как и весь остальной API — авторизация отложена (Этап 7)
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'kind', 'plan_item']

    def get_permissions(self):
        if self.action in ('budget_limit_correction_preview', 'budget_limit_correction'):
            return [has_capability('budget_limit_correction')()]
        return [AllowAny()]

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

    def destroy(self, request, *args, **kwargs):
        """Удалить черновик заявки (решение пользователя 2026-11-20) — не стандартный
        ModelViewSet.destroy(): все дочерние DRAFT-строки ссылаются на ChangeRequest через
        on_delete=PROTECT (см. docstring модели), поэтому "голый" DELETE уронил бы
        ProtectedError. cr_service.delete_draft() удаляет дочерние строки в правильном
        порядке и разрешает это только для status=DRAFT."""
        change_request = self.get_object()
        try:
            cr_service.delete_draft(change_request)
        except DjangoValidationError as exc:
            return Response({'detail': _error_message(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=RedistributionCreateSerializer, responses=ChangeRequestSerializer)
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

    @extend_schema(request=BudgetLimitCorrectionPreviewRequestSerializer,
                  responses=BudgetLimitCorrectionPreviewResponseSerializer)
    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def budget_limit_correction_preview(self, request):
        """Предпросмотр разбора fin_YYYY.xlsb от Казначейства (Этап 3.4/задание фронтенда
        2026-11-19) — НЕ пишет в БД, только разбирает файл и возвращает строки +
        несопоставленные статьи, чтобы специалист мог проверить/поправить перед сохранением
        (см. budget_limit_correction/ для подтверждения)."""
        serializer = BudgetLimitCorrectionPreviewRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        uploaded = data['file']
        suffix = os.path.splitext(uploaded.name)[1] or '.xlsb'
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            for chunk in uploaded.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        try:
            result = fin_file_parser.build_preview(tmp_path, data['year'], unk=data.get('unk'))
        except Exception as exc:
            return Response({'detail': f'Не удалось разобрать файл: {exc}'}, status=status.HTTP_400_BAD_REQUEST)
        finally:
            os.remove(tmp_path)

        return Response(BudgetLimitCorrectionPreviewResponseSerializer(result).data)

    @extend_schema(request=BudgetLimitCorrectionCreateSerializer, responses=ChangeRequestSerializer)
    @action(detail=False, methods=['post'])
    def budget_limit_correction(self, request):
        """Подтверждение предпросмотра (возможно, отредактированного на фронте) — создаёт
        заявку kind=BUDGET_LIMIT_CORRECTION с черновиками ArticleQuarterlyAllocation (см.
        cr_service.create_budget_limit_correction). Файл сюда не передаётся повторно —
        только уже разобранный список строк."""
        serializer = BudgetLimitCorrectionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            change_request = cr_service.create_budget_limit_correction(data['lines'], reason=data['reason'])
        except DjangoValidationError as exc:
            return Response({'detail': _error_message(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ChangeRequestSerializer(change_request).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses=ChangeRequestSerializer)
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        change_request = self.get_object()
        try:
            cr_service.submit(change_request)
        except DjangoValidationError as exc:
            return Response({'detail': _error_message(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ChangeRequestSerializer(change_request).data)

    @extend_schema(request=None, responses=ChangeRequestSerializer)
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        change_request = self.get_object()
        try:
            cr_service.approve(change_request)
        except DjangoValidationError as exc:
            return Response({'detail': _error_message(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ChangeRequestSerializer(change_request).data)

    @extend_schema(request=RejectSerializer, responses=ChangeRequestSerializer)
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

    @extend_schema(request=None, responses=_FORECAST_RESPONSE)
    @action(detail=True, methods=['get'])
    def forecast(self, request, pk=None):
        change_request = self.get_object()
        return Response(cr_service.compute_forecast(change_request))


def _error_message(exc):
    if isinstance(exc, DjangoValidationError):
        return exc.messages[0] if exc.messages else str(exc)
    return str(exc)
