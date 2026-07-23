import type { components, paths } from "./generated";

export type ApiPaths = paths;
export type ApiSchemas = components["schemas"];

type GeneratedPlanItemFull = ApiSchemas["PlanItemFull"];
type GeneratedEconomicDetail =
  GeneratedPlanItemFull["economic_details"][number];

export type PlanItemShort = ApiSchemas["PlanItemShort"];
// TODO: убрать временный тип после исправления OpenAPI-схемы.
// Сейчас drf-spectacular описывает cost_departments как string, хотя API
// возвращает массив распределений финансирования по подразделениям.
export type CostDepartment = {
  readonly id: number;
  status?: ApiSchemas["StatusEnum"];
  readonly department_detail: Omit<
    ApiSchemas["DepartmentTree"],
    "sub_departments"
  >;
  shared_amount: string;
  readonly total_shared_cost: number;
  shared_cost: string;
  shared_fund_cost: string;
  shared_inner_cost: string;
};
export type PlanItemFull = Omit<GeneratedPlanItemFull, "economic_details"> & {
  readonly economic_details: Array<
    Omit<GeneratedEconomicDetail, "cost_departments"> & {
      readonly cost_departments: CostDepartment[];
    }
  >;
};
export type PlanItem = ApiSchemas["PlanItem"];

export type BudgetCostsImport = ApiSchemas["BudgetCostsImport"];

export type Buyer = ApiSchemas["Buyer"];

export type Contract = ApiSchemas["Contract"];
export type ContractItem = ApiSchemas["ContractItem"];

// TODO: временный тип — убрать после доработки бэка.
// Сейчас drf-spectacular отдаёт рекурсивное поле sub_departments как string,
// хотя реально API возвращает массив таких же узлов. Когда схема будет
// исправлена, вернуть простой алиас: ApiSchemas["DepartmentTree"].
export type Department = Omit<
  ApiSchemas["DepartmentTree"],
  "sub_departments"
> & {
  readonly sub_departments: Department[];
};

export type EconomicCode = ApiSchemas["ExternalEconomicCode"];

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

export type StatusEnum = ApiSchemas["StatusEnum"];
export type TypeEnum = ApiSchemas["TypeEnum"];

export type PaginatedBudgetCostsImportList =
  ApiSchemas["PaginatedBudgetCostsImportList"];
export type PaginatedContractList = ApiSchemas["PaginatedContractList"];

export type ProcurementMethodDetail = ApiSchemas["ProcurementMethodDetail"];
export type Purchase = ApiSchemas["Purchases"];

export type Supplier = ApiSchemas["Supplier"];

export type TreasuryPayment = ApiSchemas["TreasuryPayment"];

export type UnitOfMeasurement = ApiSchemas["UnitOfMeasurement"];
