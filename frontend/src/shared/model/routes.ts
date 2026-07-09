import "react-router/dom";

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  PLANS: "/plans",
  PLAN_ITEMS: "/plan-items",
  PLAN_ITEM_ADD: "/plan-items/add",
  PLAN_ITEM: "/plan-items/:id",
  ECONOMIC_CLASSIFIER: `/economic-classifier`,
  DEPARTMENTS: `/departments`,
  CODES_OKRB: `/codes-okrb`,
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
