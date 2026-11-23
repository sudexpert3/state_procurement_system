import z from "zod";

export const kindOfPaymentSchema = z.object({
  name: z.string().min(1, "Обязательное поле"),
  is_refund: z.boolean(),
});

export type KindOfPaymentValues = z.input<typeof kindOfPaymentSchema>;
