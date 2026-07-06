import "react-router/dom";

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  PROCUREMENTS: "/procurements",
  PROCUREMENT_ADD: "/procurement/add",
  PROCUREMENT: "/procurement/:id",
  ECONOMIC_CLASSIFIER: `/economic-classifier`,
  CODES: `/codes`,
  BUYERS: `/buyers`,
  USERS: `/users`,
  NOT_FOUND: "*",
} as const;

export type PathParams = {
  [ROUTES.PROCUREMENT]: {
    id: string;
  };
};

declare module "react-router/dom" {
  interface Register {
    params: PathParams;
  }
}
