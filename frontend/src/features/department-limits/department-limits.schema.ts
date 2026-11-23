import { z } from "zod";

// Статус (DRAFT/ACTIVE/ARCHIVE) не входит в схему — он read-only на бэкенде,
// меняется только через отдельный action `activate` (см. CurrentStatus.md,
// запись 2026-11-23), а не через создание/правку записи.
export const departmentLimitSchema = z
  .object({
    functional_class: z.number().nullable(),
    economic_class: z.number().nullable(),
    internal_economic_class: z.number().nullable(),
    department: z.number().nullable(),
    year: z.coerce.number<number>().int().min(2000).max(2100),
    amount: z.coerce
      .number<number>()
      .min(0, "Сумма не может быть отрицательной"),
    note: z.string(),
    effective_date: z.coerce.date<Date>({ error: "Укажите дату записи" }),
    // Дата деактивации необязательна — проставляется вручную или
    // автоматически при activate() прежней версии связки.
    deactivated_at: z.coerce.date<Date>().nullable(),
  })
  .refine((v) => v.functional_class !== null, {
    error: "Выберите параграф",
    path: ["functional_class"],
  })
  .refine((v) => v.economic_class !== null, {
    error: "Выберите статью ЭКР",
    path: ["economic_class"],
  })
  .refine((v) => v.internal_economic_class !== null, {
    error: "Выберите внутренний код ЭКР",
    path: ["internal_economic_class"],
  })
  .refine((v) => v.department !== null, {
    error: "Выберите подразделение",
    path: ["department"],
  });

export type DepartmentLimitFormInput = z.input<typeof departmentLimitSchema>;
export type DepartmentLimitFormValues = z.output<typeof departmentLimitSchema>;
