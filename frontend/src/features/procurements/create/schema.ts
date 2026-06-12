import z from "zod";

import { yearDistributionSchema } from "@/features/procurements/create/form/contract-section/quarter.schema";

import { contractStatus } from "./config";

const positiveInt = (label: string) =>
  z.coerce
    .number<number>({ error: `${label} должен быть числом` })
    .int(`${label} должен быть целым числом`)
    .positive(`${label} должен быть больше 0`);

const additionalInfoSchema = z
  .object({
    articleNumber: positiveInt("Статья"),
    pstNumber: positiveInt("ПСТ"),
    elNumber: positiveInt("ЭЛ"),
    economicClass: positiveInt("Экономическая классификация"),
    subElementNumber: positiveInt("Подэлемент"),
    elementNumber: positiveInt("Элемент"),
    expenseCategory: z.string().min(1, "Обязательное поле"),
    departmentId: z.string().min(1, "Обязательное поле"),
    volume: positiveInt("Обязательное поле"),
    cost: positiveInt("Обязательное поле"),
  })
  .optional();

export const baseInfoSchema = z.object({
  planPointNumber: z.string().min(1, "Обязательное поле"),
  okrbCode: z.string().min(1, "Обязательное поле"),
  goodsName: z.string().min(1, "Обязательное поле"),
  okrbName: z.string().min(1, "Обязательное поле"),
  typeOfGoodsId: z.string().min(1, "Обязательное поле"),
  allVolume: positiveInt("Обязательное поле"),
  allCost: positiveInt("Обязательное поле"),
  units: z.string().min(1, "Обязательное поле"),
  customerId: z.string().min(1, "Обязательное поле"),
  procurementItems: z.array(additionalInfoSchema),
});

const contractInfoSchema = z.object({
  contractNumber: z.string().min(1, "Обязательное поле"),
  contractDate: z.coerce.date<Date>({
    error: "Введите дату договора",
  }),
  supplierId: z.string().min(1, "Обязательное поле"),
  contractTerms: z.string().min(1, "Обязательное поле"),
  contractNotes: z.string().min(1, "Обязательное поле"),
  contractStatus: z.enum(contractStatus),
  customerAccounts: z.array(z.string().min(1, "Обязательное поле")),
  currentPlanBalance: z.coerce.number<number>().positive("Обязательное поле"),
  contractSum: z.coerce.number<number>().positive("Обязательное поле"),
  totalLiabilities: z.coerce.number<number>().positive("Обязательное поле"),
  variance: z.coerce.number<number>(),
  remainingBalance: z.coerce.number<number>(),
  quarterDistribution: z.array(yearDistributionSchema),
});

const planningInfoSchema = z.object({
  expenseCategory: z.string().min(1, "Обязательное поле"),
  viewObject: z.string().min(1, "Обязательное поле"),
  viewProcedure: z.string().min(1, "Обязательное поле"),
  itemList: z.string().min(1, "Обязательное поле"),
  planNumber: positiveInt("Номер плана"),
  planDate: z.coerce.date<Date>({
    error: "Введите дату плана",
  }),
  planChangeDate: z.coerce.date<Date>({
    error: "Введите дату изменения плана",
  }),
});

export const procurementSchema = z
  .object({
    ...baseInfoSchema.shape,
    ...planningInfoSchema.shape,
    ...contractInfoSchema.shape,
  })
  .refine((data) => data.currentPlanBalance > data.contractSum, {
    error: "Сумма договора не может быть больше текущей суммы плана",
    path: ["contractSum"],
  });

export type BaseInfoValues = z.infer<typeof baseInfoSchema>;
export type ContractInfoValues = z.infer<typeof contractInfoSchema>;
export type PlanningInfoValues = z.infer<typeof planningInfoSchema>;

export type ProcurementFormValues = z.infer<typeof procurementSchema>;
export type ProcurementFormInput = z.input<typeof procurementSchema>;
export type ProcurementFormOutput = z.output<typeof procurementSchema>;

export type AdditionalInfoValues = z.infer<typeof additionalInfoSchema>;
