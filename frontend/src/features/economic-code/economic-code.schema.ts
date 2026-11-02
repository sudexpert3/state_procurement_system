import z from "zod";

export const economicCodeSchema = z.object({
  code_api: z.string().min(1, "Обязательное поле"),
  description: z.string().min(1, "Обязательное поле"),
  is_active: z.boolean(),
});

export type EconomicCodeValues = z.input<typeof economicCodeSchema>;
