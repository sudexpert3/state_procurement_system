import type { components, paths } from "./generated";

export type ApiPaths = paths;
export type ApiSchemas = components["schemas"];

export type BudgetCostsImport = ApiSchemas["BudgetCostsImport"];
export type Buyer = ApiSchemas["Buyer"];
export type Contract = ApiSchemas["Contract"];
export type ContractItem = ApiSchemas["ContractItem"];
export type Department = ApiSchemas["Department"];
export type Departments = ApiSchemas["Department"];
export type PaginatedBudgetCostsImportList =
  ApiSchemas["PaginatedBudgetCostsImportList"];
export type PaginatedContractList = ApiSchemas["PaginatedContractList"];
export type ProcurementMethodDetail = ApiSchemas["ProcurementMethodDetail"];
export type Supplier = ApiSchemas["Supplier"];
export type TreasuryPayment = ApiSchemas["TreasuryPayment"];
export type UnitOfMeasurement = ApiSchemas["UnitOfMeasurement"];
