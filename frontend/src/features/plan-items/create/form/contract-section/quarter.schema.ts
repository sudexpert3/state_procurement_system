import { z } from "zod";

const quarterRowSchema = z.object({
  q1: z.number().min(0).default(0),
  q2: z.number().min(0).default(0),
  q3: z.number().min(0).default(0),
  q4: z.number().min(0).default(0),
});

export const yearDistributionSchema = z
  .object({
    id: z.string(),
    year: z.number().int().min(2000).max(2100),
    financing: quarterRowSchema,
    plan: quarterRowSchema,
    transfer: quarterRowSchema,
  })
  // Поквартально: подлежит к оплате (plan) не может превышать оплаченное (financing)
  .refine(
    (data) =>
      data.plan.q1 <= data.financing.q1 &&
      data.plan.q2 <= data.financing.q2 &&
      data.plan.q3 <= data.financing.q3 &&
      data.plan.q4 <= data.financing.q4,
    {
      error: "Подлежит к оплате не может быть больше оплачено",
      path: ["plan"],
    },
  );

export type YearDistribution = z.infer<typeof yearDistributionSchema>;
export type QuarterRow = z.infer<typeof quarterRowSchema>;
