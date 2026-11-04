// Эндпоинты /api/reports/* — обычные APIView без serializer_class, drf-spectacular
// не генерирует для них ни параметров запроса, ни формы ответа (см.
// doc/frontend_handoff.md, раздел 8: «у новых APIView те же unable to guess
// serializer предупреждения»). Формы ниже заданы руками по текстовому описанию
// бэкенд-агента, а не из generated.ts — поэтому запросы идут через обычный fetch,
// а не через типизированный rqClient (см. ./api.ts).

export type GeneralMoneyRow = {
  functional_class_id: number;
  economic_class_id: number;
  functional_code: string;
  economic_code: string;
  economic_description: string;
  year: number;
  planned_annual: number;
  prior_years_obligations: number;
  allocated_limit: number;
  unassigned_limit: number;
  entered_into_plan: number;
  committed_obligations: number;
  paid_actual: number;
  unallocated_limit: number;
  remainder_unobligated: number;
  remainder_with_actual: number;
};

export type BudgetExecutionRow = {
  department_id: number;
  department: string;
  year: number;
  quarter: string | null;
  internal_economic_class_id: number;
  internal_economic_class_code: string;
  internal_economic_class_name: string;
  allocated: number;
  committed_obligations: number;
  paid: number;
  remainder: number;
};
