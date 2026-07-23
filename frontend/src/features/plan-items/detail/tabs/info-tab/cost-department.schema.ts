import { z } from "zod";

const nonNegativeNumber = z.coerce
  .number<number>({ error: "Введите число" })
  .min(0, "Значение не может быть отрицательным");

export const costDepartmentSchema = z.object({
  department_id: z.number().positive("Выберите подразделение"),
  shared_amount: nonNegativeNumber,
  shared_cost: nonNegativeNumber,
  shared_inner_cost: nonNegativeNumber,
  shared_fund_cost: nonNegativeNumber,
});

export type CostDepartmentFormInput = z.input<typeof costDepartmentSchema>;
export type CostDepartmentFormValues = z.output<typeof costDepartmentSchema>;
