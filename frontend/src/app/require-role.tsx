import type { ApiSchemas } from "@/shared/api/schema";

import { Navigate, Outlet } from "react-router";

import { useCurrentUser } from "@/services/auth";
import { ROUTES } from "@/shared/model/routes";

type Props = {
  role: ApiSchemas["RoleEnum"];
};

/**
 * Защита роута по роли — доп. к скрытию пункта меню в сайдбаре (оно само по
 * себе не защищает от прямого перехода по URL). `/api/users/` на бэке и так
 * вернёт 403 не-админу, но без этой обёртки страница всё равно отрисовалась бы
 * с пустой/ошибочной таблицей вместо понятного редиректа.
 */
export const RequireRole = ({ role }: Props) => {
  const { data: currentUser, isLoading } = useCurrentUser();

  if (isLoading) return null;

  if (currentUser?.role !== role) {
    return <Navigate to={ROUTES.PLAN_ITEMS} replace />;
  }

  return <Outlet />;
};
