import z from "zod";

export const internalEconomicCodeSchema = z.object({
  code: z.string().min(1, "Обязательное поле"),
  name: z.string().min(1, "Обязательное поле"),
  is_active: z.boolean(),
  parent: z.coerce.number<number>().nullable(),
});

export type InternalEconomicCodeValues = z.input<
  typeof internalEconomicCodeSchema
>;
