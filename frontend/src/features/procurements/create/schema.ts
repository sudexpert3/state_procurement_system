import z from "zod";

import { contractItemSchema } from "@/features/procurements/create/form/contract-section/contract.schema";

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
    departmentId: z.coerce.number<number>(),
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

// Поля уровня плана + массив договоров.
// Реквизиты/суммы конкретного договора — в contractItemSchema.
// Производные (обязательства/отклонение/остаток) не храним — считаются в UI.
const contractInfoSchema = z.object({
  currentPlanBalance: z.coerce.number<number>().positive("Обязательное поле"),
  customerAccounts: z.array(z.string().min(1, "Обязательное поле")),
  contracts: z.array(contractItemSchema),
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

export const procurementSchema = z.object({
  ...baseInfoSchema.shape,
  ...planningInfoSchema.shape,
  ...contractInfoSchema.shape,
});

export type BaseInfoValues = z.infer<typeof baseInfoSchema>;
export type ContractInfoValues = z.infer<typeof contractInfoSchema>;
export type PlanningInfoValues = z.infer<typeof planningInfoSchema>;

export type ProcurementFormValues = z.infer<typeof procurementSchema>;
export type ProcurementFormInput = z.input<typeof procurementSchema>;
export type ProcurementFormOutput = z.output<typeof procurementSchema>;

export type AdditionalInfoValues = z.infer<typeof additionalInfoSchema>;
