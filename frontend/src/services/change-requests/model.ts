import type { ChangeRequestKind, ChangeRequestStatus } from "./types";

export const CHANGE_REQUEST_KIND_LABELS: Record<ChangeRequestKind, string> = {
  PLAN_ITEM_CHANGE: "Изменение позиции плана",
  PLAN_ITEM_EXCLUSION: "Исключение позиции плана",
  LIMIT_REDISTRIBUTION: "Перераспределение лимита",
  BUDGET_LIMIT_CORRECTION: "Корректировка лимита (Казначейство)",
  DEPARTMENT_LIMIT_CALIBRATION: "Калибровка лимитов по подразделениям",
};

export const CHANGE_REQUEST_STATUS_LABELS: Record<ChangeRequestStatus, string> =
  {
    DRAFT: "Черновик",
    ON_REVIEW: "На проверке",
    APPROVED: "Одобрена",
    REJECTED: "Отклонена",
  };

export const CHANGE_REQUEST_STATUS_BADGE_VARIANT: Record<
  ChangeRequestStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "secondary",
  ON_REVIEW: "default",
  APPROVED: "outline",
  REJECTED: "destructive",
};

export const CHANGE_REQUEST_KIND_OPTIONS = (
  Object.entries(CHANGE_REQUEST_KIND_LABELS) as [ChangeRequestKind, string][]
).map(([value, label]) => ({ value, label }));

export const CHANGE_REQUEST_STATUS_OPTIONS = (
  Object.entries(CHANGE_REQUEST_STATUS_LABELS) as [
    ChangeRequestStatus,
    string,
  ][]
).map(([value, label]) => ({ value, label }));
