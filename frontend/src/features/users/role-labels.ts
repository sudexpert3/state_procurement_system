import type { ApiSchemas } from "@/shared/api/schema";

/**
 * Человекочитаемые названия ролей — текст взят буквально из описания каждой
 * роли в `core/choices.py::UserRoleType` (бэкенд, Этап 7). `role_display` с
 * бэка даёт то же самое для отображения в таблице, но для Select при
 * создании/правке пользователя нужен локальный список — API со списком ролей
 * нет (только пять фиксированных значений `RoleEnum`).
 */
export const ROLE_LABELS: Record<ApiSchemas["RoleEnum"], string> = {
  ADMIN_MAIN: "Главный администратор",
  MAIN_PURCHASER: "Главный закупщик",
  PURCHASING_SPECIALIST: "Закупщик",
  FINANCIER: "Финансист",
  HEAD: "Главный руководитель",
};

export const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(
  ([value, label]) => ({
    value: value as ApiSchemas["RoleEnum"],
    label,
  }),
);

/** Осмысленно привязывать закупщика (справочник Buyer) только этим ролям */
export const ROLES_WITH_BUYER: ApiSchemas["RoleEnum"][] = [
  "MAIN_PURCHASER",
  "PURCHASING_SPECIALIST",
];
