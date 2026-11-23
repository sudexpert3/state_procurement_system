import z from "zod";

export const unitOfMeasurementSchema = z.object({
  code: z.string().min(1, "Обязательное поле"),
  short_name: z.string().min(1, "Обязательное поле"),
  is_active: z.boolean(),
});

export type UnitOfMeasurementValues = z.input<typeof unitOfMeasurementSchema>;
