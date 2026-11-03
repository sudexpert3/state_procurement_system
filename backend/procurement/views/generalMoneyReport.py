from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from procurement.services import get_current_year
from procurement.services.general_money_report import compute_general_money_report


class GeneralMoneyReportAPIView(APIView):
    """
    Отчёт «Общие деньги» (первый отчёт из серии — решение пользователя 2026-11-03;
    остальные отчёты добавляются как отдельные пункты того же меню/эндпоинты).

    GET /api/reports/general_money/?year=2026

    Одна строка на статью (functional_class+economic_class) — org-wide, без разбивки по
    подразделениям (для разбивки по держателям лимита — /api/reports/budget_execution/,
    Этап 4.4). `year` по умолчанию — текущий календарный год.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        year_param = request.query_params.get('year')
        year = int(year_param) if year_param else get_current_year()

        rows = compute_general_money_report(year=year)
        return Response(rows)
