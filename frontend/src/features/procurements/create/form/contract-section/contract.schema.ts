import z from "zod";

import { contractStatus } from "../../config";

import { yearDistributionSchema } from "./quarter.schema";

// Покупатель, к которому привязан договор
export const buyerSchema = z.object({
  id: z.number(),
  fullName: z.string(),
  shortName: z.string(),
  isActive: z.boolean(),
});

// Единый источник правды для ОДНОГО договора.
// Поля уровня договора; суммы плана и производные значения сюда не входят.
export const contractItemSchema = z.object({
  id: z.number(),
  contractNumber: z.string().min(1, { error: "Обязательное поле" }),
  contractSum: z.coerce
    .number<number>({ error: "Должно быть числом" })
    .positive("Обязательное поле"),
  supplierId: z.string().min(1, { error: "Обязательное поле" }),
  contractDate: z.coerce.date<Date>({ error: "Введите дату договора" }),
  contractTerms: z.string().min(1, { error: "Обязательное поле" }),
  contractNotes: z.string(),
  contractStatus: z.enum(contractStatus),
  // Реквизиты, которые сейчас не редактируются в drawer, но приходят с данными
  constructionType: z.string(),
  fixedAssetsPlanItem: z.string(),
  isRegisteredInTreasury: z.boolean(),
  parentContractId: z.number().nullable(),
  plannedDeliveryDate: z.coerce.date<Date>().nullable(),
  procurementMethodDetailId: z.number(),
  buyerId: z.number(),
  buyer: buyerSchema,
  quarterDistribution: z.array(yearDistributionSchema),
});

export const makeContractItemSchema = (maxSum: number) =>
  contractItemSchema.refine((data) => data.contractSum <= maxSum, {
    error: `Сумма договора не может превышать текущую сумму плана ${maxSum} BYN`,
    path: ["contractSum"],
  });

export type Buyer = z.infer<typeof buyerSchema>;
export type ContractItem = z.infer<typeof contractItemSchema>;
export type ContractItemInput = z.input<typeof contractItemSchema>;
