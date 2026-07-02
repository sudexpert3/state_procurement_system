import type { ProcurementStatus } from "./procurement.mock";

// Подпись и цвет бейджа для каждого статуса плана.
export const statusMeta: Record<
  ProcurementStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Черновик",
    className: "bg-muted text-muted-foreground",
  },
  published: {
    label: "Опубликован",
    className: "bg-green-100 text-green-700",
  },
  archived: {
    label: "В архиве",
    className: "bg-amber-100 text-amber-700",
  },
};

export const typeLabel: Record<string, string> = {
  work: "Работа/Услуга",
  product: "Товар",
};
