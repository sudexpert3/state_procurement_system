import type { StatusEnum, TypeEnum } from "@/shared/api/schema";

type PlanStatusMeta = {
  value: StatusEnum;
  label: string;
  className: string;
};

export const typeLabel = {
  job: "Работа/Услуга",
  product: "Товар",
} as const satisfies Record<TypeEnum, string>;

export const statusMeta = {
  ACTIVE: {
    value: "ACTIVE",
    label: "Актуальный (Доступен для договоров)",
    className:
      "border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
  },
  DRAFT: {
    value: "DRAFT",
    label: "Черновик (изменения)",
    className:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  },
  EXCLUSION: {
    value: "EXCLUSION",
    label: "Черновик (исключение)",
    className:
      "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  DRAFT_ON_REVIEW: {
    value: "DRAFT_ON_REVIEW",
    label: "На проверке у финансиста (изменение)",
    className:
      "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  EXCLUSION_ON_REVIEW: {
    value: "EXCLUSION_ON_REVIEW",
    label: "На проверке у финансиста (исключение)",
    className:
      "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  DRAFT_APPROVED: {
    value: "DRAFT_APPROVED",
    label: "Одобрен финансистом (изменение)",
    className:
      "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  EXCLUSION_APPROVED: {
    value: "EXCLUSION_APPROVED",
    label: "Одобрен финансистом (исключение)",
    className:
      "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  DRAFT_REJECTED: {
    value: "DRAFT_REJECTED",
    label: "Отклонен финансистом (изменение)",
    className:
      "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  },
  EXCLUSION_REJECTED: {
    value: "EXCLUSION_REJECTED",
    label: "Отклонен финансистом (исключение)",
    className:
      "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  },
  UPLOAD: {
    value: "UPLOAD",
    label: "Загружен на площадку",
    className:
      "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  },
  ARCHIVE: {
    value: "ARCHIVE",
    label: "В архиве",
    className:
      "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  },
} as const satisfies Record<StatusEnum, PlanStatusMeta>;
