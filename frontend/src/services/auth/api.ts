import { getAccessToken } from "@/shared/api/auth-tokens";
import { rqClient } from "@/shared/api/instance";

/**
 * Текущий пользователь (включая роль) — `GET /api/auth/me/`, Этап 7 бэкенда.
 * Нужен нескольким фичам сразу (сайдбар для гейтинга меню, роутер для защиты
 * `/users` от прямого перехода по URL) — поэтому не внутри `features/auth`
 * (фичам запрещено импортировать друг друга, см. `docs/architecture.md`),
 * а в `services/`, откуда разрешён импорт любой фиче.
 */
export const useCurrentUser = () =>
  rqClient.useQuery(
    "get",
    "/api/auth/me/",
    {},
    { enabled: getAccessToken() !== null },
  );
