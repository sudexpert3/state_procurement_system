import "react-router/dom";

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  PLANS: "/plans",
  PLAN_ITEMS: "/plan-items",
  PLAN_ITEM_ADD: "/plan-items/add",
  PLAN_ITEM: "/plan-items/:id",
  CHANGE_REQUESTS: "/change-requests",
  CONTRACTS: "/contracts",
  PAYMENTS: "/payments",
  ECONOMIC_CODE: `/economic-code`,
  FUNCTIONAL_CODE: `/functional-code`,
  PROGRAM_CODE: `/program-code`,
  UNITS_OF_MEASUREMENT: `/units-of-measurement`,
  KIND_OF_PAYMENT: `/kind-of-payment`,
  DEPARTMENTS: `/departments`,
  CODES_OKRB: `/codes-okrb`,
  INTERNAL_ECONOMIC_CODE: `/internal-economic-code`,
  DEPARTMENT_LIMITS: `/department-limits`,
  REPORTS: `/reports`,
  REPORTS_GENERAL_MONEY: `/reports/general-money`,
  REPORTS_BUDGET_EXECUTION: `/reports/budget-execution`,
  BUYERS: `/buyers`,
  SUPPLIERS: `/suppliers`,
  USERS: `/users`,
  NOT_FOUND: "*",
} as const;

export type PathParams = {
  [ROUTES.PLAN_ITEM]: {
    id: number;
  };
};

declare module "react-router/dom" {
  interface Register {
    params: PathParams;
  }
}
