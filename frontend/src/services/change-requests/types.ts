import type { ApiSchemas } from "@/shared/api/schema";

export type ChangeRequest = ApiSchemas["ChangeRequest"];
export type ChangeRequestKind = ApiSchemas["KindEnum"];
export type ChangeRequestStatus = ApiSchemas["ChangeRequestStatusEnum"];

// Кастомные действия ChangeRequestViewSet (submit/approve/reject/forecast/redistribute/
// calibrate_department_limits) не имеют собственного serializer_class — drf-spectacular
// не может угадать реальную форму тела запроса/ответа и подставляет serializer самого
// ViewSet (ChangeRequestSerializer), см. doc/frontend_handoff.md, раздел 8. Поэтому формы
// ниже заданы руками по текстовому описанию бэкенд-агента, а не из generated.ts.

export type RejectPayload = {
  rejection_reason: string;
};

export type RedistributionLinePayload = {
  budget_cost: number;
  plan_share: number | null;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  amount: string;
};

export type RedistributePayload = {
  reason: string;
  lines: RedistributionLinePayload[];
};

export type CalibrateDepartmentLimitsPayload = {
  functional_class: number;
  economic_class: number;
  year: number;
  reason: string;
};

export type ForecastArticleLine = {
  year: number;
  economic_code: string;
  new_allocated: number;
  committed_obligations: number;
  is_over_budget: boolean;
  shortfall: number;
};

export type ForecastDepartmentChangeLine = ForecastArticleLine & {
  department: string;
};

export type ForecastPlanItemChange = {
  by_article: ForecastArticleLine[];
  by_department: ForecastDepartmentChangeLine[];
};

export type ForecastDepartmentExclusionLine = {
  department: string;
  year: number;
  allocated: number;
  committed_obligations: number;
};

export type ForecastPlanItemExclusion = {
  by_department: ForecastDepartmentExclusionLine[];
};

export type ForecastRedistributionLine = {
  budget_cost_id: number;
  economic_code: string;
  department: string | null;
  quarter: string;
  old_amount: number;
  new_amount: number;
  delta: number;
};

export type ForecastLimitRedistribution = {
  lines: ForecastRedistributionLine[];
  net_delta: number;
};

export type ForecastBudgetCorrectionLine = {
  functional_code: string;
  economic_code: string;
  year: number;
  quarter: string;
  old_amount: number;
  new_amount: number;
  delta: number;
};

export type ForecastBudgetLimitCorrection = {
  lines: ForecastBudgetCorrectionLine[];
  net_delta: number;
};

export type ForecastSubarticleLine = {
  internal_economic_class_id: number;
  internal_economic_class_code: string;
  amount: number;
};

export type ForecastDepartmentLine = {
  internal_economic_class_id: number;
  internal_economic_class_code: string;
  department: string;
  amount: number;
};

export type ForecastSubarticleBalance = {
  internal_economic_class_id: number;
  internal_economic_class_code: string;
  subarticle_total: number;
  departments_sum: number;
  diff: number;
};

export type ForecastDepartmentLimitCalibration = {
  functional_code: string;
  economic_code: string;
  year: number;
  article_total: number;
  prior_years_obligations: number;
  article_available: number;
  subarticle_sum: number;
  article_diff: number;
  subarticle_lines: ForecastSubarticleLine[];
  department_lines: ForecastDepartmentLine[];
  subarticle_balance: ForecastSubarticleBalance[];
  is_balanced: boolean;
};

export type ChangeRequestForecast =
  | ForecastPlanItemChange
  | ForecastPlanItemExclusion
  | ForecastLimitRedistribution
  | ForecastBudgetLimitCorrection
  | ForecastDepartmentLimitCalibration;
