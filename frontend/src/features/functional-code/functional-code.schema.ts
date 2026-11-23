import z from "zod";

export const functionalCodeSchema = z.object({
  code_api: z.string().min(1, "Обязательное поле"),
  description: z.string().min(1, "Обязательное поле"),
  is_active: z.boolean(),
});

export type FunctionalCodeValues = z.input<typeof functionalCodeSchema>;
