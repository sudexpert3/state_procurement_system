import { z } from "zod";

export const paymentSchema = z
  .object({
    mode: z.enum(["contract", "free"]),
    contract: z.number().nullable(),
    departments: z.array(z.number()),
    economic_class: z.number().nullable(),
    functional_class: z.number().nullable(),
    amount: z.coerce.number<number>().positive("Сумма должна быть больше 0"),
    payment_date: z.coerce.date<Date>({ error: "Укажите дату платежа" }),
    notice: z.string(),
  })
  .refine((values) => values.mode !== "contract" || values.contract !== null, {
    error: "Выберите договор",
    path: ["contract"],
  })
  .refine((values) => values.mode !== "free" || values.departments.length > 0, {
    error: "Выберите хотя бы одно подразделение",
    path: ["departments"],
  })
  .refine(
    (values) => values.mode !== "free" || values.economic_class !== null,
    { error: "Выберите статью ЭКР", path: ["economic_class"] },
  )
  .refine(
    (values) => values.mode !== "free" || values.functional_class !== null,
    {
      error: "Выберите функциональную классификацию",
      path: ["functional_class"],
    },
  );

export type PaymentFormInput = z.input<typeof paymentSchema>;
export type PaymentFormValues = z.output<typeof paymentSchema>;
