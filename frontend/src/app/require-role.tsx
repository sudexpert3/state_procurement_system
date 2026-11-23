import type { ApiSchemas } from "@/shared/api/schema";

import { Navigate, Outlet } from "react-router";

import { useCurrentUser } from "@/services/auth";
import { ROUTES } from "@/shared/model/routes";

type Props = {
  role: ApiSchemas["RoleEnum"] | ApiSchemas["RoleEnum"][];
};

/**
 * Защита роута по роли — доп. к скрытию пункта меню в сайдбаре (оно само по
 * себе не защищает от прямого перехода по URL). Бэкенд на эндпоинтах за этой
 * ролью и так вернёт 403, но без этой обёртки страница всё равно отрисовалась бы
 * с пустой/ошибочной таблицей вместо понятного редиректа.
 */
export const RequireRole = ({ role }: Props) => {
  const { data: currentUser, isLoading } = useCurrentUser();

  if (isLoading) return null;

  const allowedRoles = Array.isArray(role) ? role : [role];

  if (!currentUser || !allowedRoles.includes(currentUser.role)) {
    return <Navigate to={ROUTES.PLAN_ITEMS} replace />;
  }

  return <Outlet />;
};
