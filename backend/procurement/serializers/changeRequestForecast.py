# -*- coding: utf-8 -*-
"""
Схемы ТОЛЬКО для документации OpenAPI (drf-spectacular) — `ChangeRequestViewSet.forecast()`
не сериализует данные через эти классы (возвращает обычный dict из
`services.change_requests.compute_forecast()`), они нужны исключительно чтобы
сгенерированная схема/типы не врали, что ответ — это `ChangeRequest` (drf-spectacular по
умолчанию брал `serializer_class` вьюсета для любого кастомного action без аннотации).

Форма ответа зависит от `ChangeRequest.kind` — 4 разных формы, см. docstring
`compute_forecast()`. Используется как `PolymorphicProxySerializer` с дискриминатором `kind`
(который `compute_forecast()` теперь добавляет в результат, см. change_requests.py).
"""
from rest_framework import serializers

from core.choices import ChangeRequestKind


class PlanItemChangeForecastArticleLineSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    economic_code = serializers.CharField(allow_null=True)
    new_allocated = serializers.DecimalField(max_digits=15, decimal_places=2)
    committed_obligations = serializers.DecimalField(max_digits=15, decimal_places=2)
    is_over_budget = serializers.BooleanField()
    shortfall = serializers.DecimalField(max_digits=15, decimal_places=2)


class PlanItemChangeForecastDepartmentLineSerializer(serializers.Serializer):
    department = serializers.CharField()
    year = serializers.IntegerField()
    new_allocated = serializers.DecimalField(max_digits=15, decimal_places=2)
    committed_obligations = serializers.DecimalField(max_digits=15, decimal_places=2)
    is_over_budget = serializers.BooleanField()
    shortfall = serializers.DecimalField(max_digits=15, decimal_places=2)


class PlanItemChangeForecastSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=[ChangeRequestKind.PLAN_ITEM_CHANGE.value])
    by_article = PlanItemChangeForecastArticleLineSerializer(many=True)
    by_department = PlanItemChangeForecastDepartmentLineSerializer(many=True)


class PlanItemExclusionForecastLineSerializer(serializers.Serializer):
    department = serializers.CharField()
    year = serializers.IntegerField()
    allocated = serializers.DecimalField(max_digits=15, decimal_places=2)
    committed_obligations = serializers.DecimalField(max_digits=15, decimal_places=2)


class PlanItemExclusionForecastSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=[ChangeRequestKind.PLAN_ITEM_EXCLUSION.value])
    by_department = PlanItemExclusionForecastLineSerializer(many=True)


class RedistributionForecastLineSerializer(serializers.Serializer):
    budget_cost_id = serializers.IntegerField()
    economic_code = serializers.CharField(allow_null=True)
    department = serializers.CharField(allow_null=True)
    quarter = serializers.CharField()
    old_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    new_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    delta = serializers.DecimalField(max_digits=15, decimal_places=2)


class RedistributionForecastSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=[ChangeRequestKind.LIMIT_REDISTRIBUTION.value])
    lines = RedistributionForecastLineSerializer(many=True)
    net_delta = serializers.DecimalField(max_digits=15, decimal_places=2)


class BudgetLimitCorrectionForecastLineSerializer(serializers.Serializer):
    functional_code = serializers.CharField()
    economic_code = serializers.CharField()
    year = serializers.IntegerField()
    quarter = serializers.CharField()
    old_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    new_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    delta = serializers.DecimalField(max_digits=15, decimal_places=2)


class BudgetLimitCorrectionForecastSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=[ChangeRequestKind.BUDGET_LIMIT_CORRECTION.value])
    lines = BudgetLimitCorrectionForecastLineSerializer(many=True)
    net_delta = serializers.DecimalField(max_digits=15, decimal_places=2)


