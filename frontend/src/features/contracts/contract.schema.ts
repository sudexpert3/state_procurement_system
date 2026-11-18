import { z } from "zod";

// Поля заголовка договора (Contract) — спецификация/платежи/квартальный
// план редактируются отдельно (ContractItem/TreasuryPayment/
// ContractQuarterlyFinance), в эту форму не входят.
export const contractSchema = z
  .object({
    number: z.string().min(1, { error: "Обязательное поле" }),
    contract_date: z.coerce.date<Date>().nullable(),
    supplier: z.number().nullable(),
    total_cost: z.coerce
      .number<number>({ error: "Должно быть числом" })
      .positive("Сумма должна быть больше 0"),
    buyer: z.number().nullable(),
    payment_terms: z.string(),
    planned_delivery_date: z.coerce.date<Date>().nullable(),
    notice: z.string(),
    is_registered_in_treasury: z.boolean(),
    construction_type: z.string(),
    procurement_method_detail: z.number().nullable(),
    fixed_assets_plan_item: z.string(),
    /** Основной договор (для Доп. соглашений) */
    parent_contract: z.number().nullable(),
  })
  .refine((values) => values.supplier !== null, {
    error: "Выберите поставщика",
    path: ["supplier"],
  })
  .refine((values) => values.planned_delivery_date !== null, {
    error: "Укажите плановую дату исполнения",
    path: ["planned_delivery_date"],
  });

export type ContractFormInput = z.input<typeof contractSchema>;
export type ContractFormValues = z.output<typeof contractSchema>;
