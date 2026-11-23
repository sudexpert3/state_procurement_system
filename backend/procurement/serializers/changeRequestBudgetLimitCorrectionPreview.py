# -*- coding: utf-8 -*-
"""
Предпросмотр разбора fin_YYYY.xlsb от Казначейства (Этап 3.4) — ЗАДАНИЕ БЭКЕНДУ от фронтенда
2026-11-19 (см. CurrentStatus.md). Отдельный файл (не changeRequest.py) — эти сериализаторы
нужны только для запроса/ответа предпросмотра (который ничего не пишет в БД, см.
views/changeRequest.py::budget_limit_correction_preview), а не для создания самой заявки.
"""
from rest_framework import serializers

from procurement.serializers.functionalCode import FunctionalCodeSerializer
from procurement.serializers.externalEconomicCode import ExternalEconomicCodeSerializer


class BudgetLimitCorrectionPreviewRequestSerializer(serializers.Serializer):
    file = serializers.FileField()
    year = serializers.IntegerField()
    unk = serializers.IntegerField(required=False, allow_null=True,
                                    help_text='По умолчанию — settings.DEFAULT_UNK (Центральный аппарат ГКСЭ).')


class BudgetLimitCorrectionPreviewLineSerializer(serializers.Serializer):
    """Та же форма, что принимает подтверждение (BudgetLimitCorrectionCreateSerializer),
    плюс `*_detail` — расшифровка кодов для отображения на фронте без доп. запроса."""
    functional_class = serializers.IntegerField()
    functional_class_detail = FunctionalCodeSerializer(read_only=True)
    economic_class = serializers.IntegerField()
    economic_class_detail = ExternalEconomicCodeSerializer(read_only=True)
    year = serializers.IntegerField()
    quarter = serializers.CharField()
    amount = serializers.DecimalField(max_digits=15, decimal_places=2)


class BudgetLimitCorrectionPreviewExcludedLineSerializer(serializers.Serializer):
    """Статьи, исключённые правилом fin_file_parser.EXCLUDED_ARTICLES (решение пользователя,
    не ошибка разбора) — сырые коды из файла, не сопоставленные со справочником."""
    functional_raw_code = serializers.CharField()
    economic_raw_code = serializers.CharField()


class BudgetLimitCorrectionPreviewReportSerializer(serializers.Serializer):
    rows_total = serializers.IntegerField()
    matched_articles = serializers.IntegerField()
    excluded = BudgetLimitCorrectionPreviewExcludedLineSerializer(many=True)
    functional_not_found = serializers.ListField(child=serializers.CharField())
    economic_not_found = serializers.ListField(child=serializers.CharField())


class BudgetLimitCorrectionPreviewResponseSerializer(serializers.Serializer):
    lines = BudgetLimitCorrectionPreviewLineSerializer(many=True)
    report = BudgetLimitCorrectionPreviewReportSerializer()
