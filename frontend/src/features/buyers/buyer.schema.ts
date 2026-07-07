import z from "zod";

export const buyerSchema = z.object({
  shot_name: z.string().min(1, "Обязательное поле"),
  full_name: z.string().min(1, "Обязательное поле"),
  is_active: z.boolean(),
});

export type BuyerValues = z.input<typeof buyerSchema>;
