import type { ApiSchemas } from "@/shared/api/schema";

export type ChangeRequest = ApiSchemas["ChangeRequest"];
// Схема переименовала этот enum в ChangeRequestKindEnum: добавление отдельных
// *ForecastKindEnum-дискриминаторов (см. ниже) заставило openapi-typescript
// разрешить коллизию имён "KindEnum" между несколькими схемами.
export type ChangeRequestKind = ApiSchemas["ChangeRequestKindEnum"];
export type ChangeRequestStatus = ApiSchemas["ChangeRequestStatusEnum"];

// Бэкенд починил типизацию кастомных действий ChangeRequestViewSet через
// @extend_schema/PolymorphicProxySerializer (2026-11-05) — submit/approve/reject/
// forecast/redistribute/calibrate_department_limits теперь генерируют честные
// типы из generated.ts, поэтому ниже просто алиасы вместо ручных копий формы.
// Денежные поля (Format: decimal у DRF) сериализуются строкой, не числом —
// readByn()/formatByn() в UI уже принимают string | number.

export type RejectPayload = ApiSchemas["Reject"];

export type RedistributionLinePayload = ApiSchemas["RedistributionLine"];

export type RedistributePayload = ApiSchemas["RedistributionCreate"];

// Импорт файла корректировки лимитов от Казначейства (Этап 3.4/задание
// фронтенда 2026-11-19) — предпросмотр разбора fin_YYYY.xlsb без записи в БД,
// затем подтверждение (возможно, отредактированных) строк создаёт черновик
// ChangeRequest(kind=BUDGET_LIMIT_CORRECTION).
export type BudgetLimitCorrectionPreviewRequest =
  ApiSchemas["BudgetLimitCorrectionPreviewRequest"];
export type BudgetLimitCorrectionPreviewResponse =
  ApiSchemas["BudgetLimitCorrectionPreviewResponse"];
export type BudgetLimitCorrectionPreviewLine =
  ApiSchemas["BudgetLimitCorrectionPreviewLine"];
export type BudgetLimitCorrectionPreviewReport =
  ApiSchemas["BudgetLimitCorrectionPreviewReport"];
export type BudgetLimitCorrectionPreviewExcludedLine =
  ApiSchemas["BudgetLimitCorrectionPreviewExcludedLine"];
export type BudgetLimitCorrectionLine = ApiSchemas["BudgetLimitCorrectionLine"];
export type BudgetLimitCorrectionCreatePayload =
  ApiSchemas["BudgetLimitCorrectionCreate"];

export type ForecastPlanItemChange = ApiSchemas["PlanItemChangeForecast"];
export type ForecastPlanItemExclusion = ApiSchemas["PlanItemExclusionForecast"];
export type ForecastLimitRedistribution = ApiSchemas["RedistributionForecast"];
export type ForecastBudgetLimitCorrection =
  ApiSchemas["BudgetLimitCorrectionForecast"];

export type ForecastArticleLine =
  ApiSchemas["PlanItemChangeForecastArticleLine"];
export type ForecastDepartmentChangeLine =
  ApiSchemas["PlanItemChangeForecastDepartmentLine"];
export type ForecastDepartmentExclusionLine =
  ApiSchemas["PlanItemExclusionForecastLine"];
export type ForecastRedistributionLine =
  ApiSchemas["RedistributionForecastLine"];
export type ForecastBudgetCorrectionLine =
  ApiSchemas["BudgetLimitCorrectionForecastLine"];

export type ChangeRequestForecast = ApiSchemas["ChangeRequestForecast"];
