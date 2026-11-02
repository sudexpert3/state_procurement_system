from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from procurement.services.budget_execution_report import compute_budget_execution_report


class BudgetExecutionReportAPIView(APIView):
    """
    Оперативный отчёт «назначено — обязательства — оплачено — остаток» (Этап 4.4).

    GET /api/reports/budget_execution/?year=2026&department=5&quarter=Q2

    Все параметры опциональны. Без `quarter` — годовые суммы назначения; с `quarter` —
    квартальное распределение (см. BudgetQuarterlyLimit, Этап 3.3). Строки — на уровне
    (держатель лимита × статья ЭКР), группировку по иерархии подразделений и уровням
    классификатора строит фронтенд.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        year = request.query_params.get('year')
        department_id = request.query_params.get('department')
        quarter = request.query_params.get('quarter')

        rows = compute_budget_execution_report(
            year=int(year) if year else None,
            department_id=int(department_id) if department_id else None,
            quarter=quarter or None,
        )
        return Response(rows)
