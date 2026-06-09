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
  .refine((data) => data.plan >= data.financing, {
    error: "Подлежит к оплате не может быть больше оплачено",
    path: ["plan"],
  });

export type YearDistribution = z.infer<typeof yearDistributionSchema>;
export type QuarterRow = z.infer<typeof quarterRowSchema>;
