import type { components, paths } from "./generated";

export type ApiPaths = paths;
export type ApiSchemas = components["schemas"];

export type PlanItemShort = ApiSchemas["PlanItemShort"];
export type PlanItemFull = ApiSchemas["PlanItemFull"];
export type PlanItem = ApiSchemas["PlanItem"];
export type CostDepartment =
  ApiSchemas["PlanItemFull"]["economic_details"][0]["cost_departments"];

export type BudgetCostsImport = ApiSchemas["BudgetCostsImport"];

export type Buyer = ApiSchemas["Buyer"];

export type Contract = ApiSchemas["Contract"];
export type ContractItem = ApiSchemas["ContractItem"];

export type Department = ApiSchemas["DepartmentTree"];

// TODO: временный тип — убрать после доработки бэка.
// Сейчас drf-spectacular отдаёт рекурсивное поле sub_codes как string,
// хотя реально API возвращает массив таких же узлов. Когда схема будет
// исправлена, вернуть простой алиас: ApiSchemas["InternalEconomicClassifierTree"].
export type InternalEconomicCode = Omit<
  ApiSchemas["InternalEconomicClassifierTree"],
  "sub_codes"
> & {
  readonly sub_codes: InternalEconomicCode[];
};

export type OkrbProduct = ApiSchemas["OkrbProduct"];

export type PaginatedBudgetCostsImportList =
  ApiSchemas["PaginatedBudgetCostsImportList"];
export type PaginatedContractList = ApiSchemas["PaginatedContractList"];

export type ProcurementMethodDetail = ApiSchemas["ProcurementMethodDetail"];
export type Purchase = ApiSchemas["Purchases"];

export type Supplier = ApiSchemas["Supplier"];

export type TreasuryPayment = ApiSchemas["TreasuryPayment"];

export type UnitOfMeasurement = ApiSchemas["UnitOfMeasurement"];
