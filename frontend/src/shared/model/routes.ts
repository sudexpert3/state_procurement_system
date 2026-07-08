import "react-router/dom";

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  PLANS: "/plans",
  PROCUREMENTS: "/procurements",
  PROCUREMENT_ADD: "/procurement/add",
  PROCUREMENT: "/procurement/:id",
  ECONOMIC_CLASSIFIER: `/economic-classifier`,
  DEPARTMENTS: `/departments`,
  CODES: `/codes`,
  BUYERS: `/buyers`,
  SUPPLIERS: `/suppliers`,
  USERS: `/users`,
  NOT_FOUND: "*",
} as const;

export type PathParams = {
  [ROUTES.PROCUREMENT]: {
    id: number;
    purchase: number;
    limit: number;
    offset: number;
  };
};

declare module "react-router/dom" {
  interface Register {
    params: PathParams;
  }
}
