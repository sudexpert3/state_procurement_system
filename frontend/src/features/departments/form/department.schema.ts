import z from "zod";

export const departmentSchema = z.object({
  full_name: z.string().min(1, "Обязательное поле"),
  short_name: z.string().min(1, "Обязательное поле"),
  is_active: z.boolean(),
  parent: z.coerce.number<number>().nullable(),
});

export type DepartmentValues = z.input<typeof departmentSchema>;
