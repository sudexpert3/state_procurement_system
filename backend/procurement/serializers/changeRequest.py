from rest_framework import serializers

from core.choices import ChangeRequestKind
from procurement.models import ChangeRequest


class ChangeRequestSerializer(serializers.ModelSerializer):
    plan_item_num = serializers.CharField(source='plan_item.num', read_only=True, default=None)
    kind_display = serializers.CharField(source='get_kind_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ChangeRequest
        fields = [
            'id', 'plan_item', 'plan_item_num', 'kind', 'kind_display', 'status', 'status_display',
            'reason', 'rejection_reason', 'submitted_at', 'reviewed_at', 'created_at', 'changed_at',
        ]
        read_only_fields = ['status', 'rejection_reason', 'submitted_at', 'reviewed_at']


class ChangeRequestCreateSerializer(serializers.Serializer):
    """Вход для создания заявки — kind/plan_item передаются явно, а не через ModelSerializer,
    чтобы бизнес-логика (клонирование черновика и т.п.) прошла через services.change_requests,
    а не через стандартный .save() ModelSerializer."""
    plan_item = serializers.IntegerField()
    kind = serializers.ChoiceField(choices=[
        ChangeRequestKind.PLAN_ITEM_CHANGE, ChangeRequestKind.PLAN_ITEM_EXCLUSION,
    ])
    reason = serializers.CharField(required=False, allow_blank=True, default='')


class RejectSerializer(serializers.Serializer):
    rejection_reason = serializers.CharField(allow_blank=False)


class RedistributionLineSerializer(serializers.Serializer):
    budget_cost = serializers.IntegerField()
    plan_share = serializers.IntegerField(required=False, allow_null=True)
    quarter = serializers.ChoiceField(choices=['Q1', 'Q2', 'Q3', 'Q4'])
    amount = serializers.DecimalField(max_digits=15, decimal_places=2)


class RedistributionCreateSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default='')
    lines = RedistributionLineSerializer(many=True)


class DepartmentLimitCalibrationCreateSerializer(serializers.Serializer):
    """Вход для create_department_limit_calibration() — одна статья/год за раз (решение
    пользователя 2026-11-03: калибровка всегда идёт по конкретной статье Минфина)."""
    functional_class = serializers.IntegerField()
    economic_class = serializers.IntegerField()
    year = serializers.IntegerField()
    reason = serializers.CharField(required=False, allow_blank=True, default='')
