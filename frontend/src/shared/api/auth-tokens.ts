import { ENV } from "@/shared/model/env";

/**
 * Хранение и обновление JWT-токенов (`rest_framework_simplejwt`, Этап 7 бэкенда).
 * Отдельный модуль без зависимости от `instance.ts`/`rqClient` — иначе рефреш
 * внутри `onResponse`-middleware самого `instance.ts` создал бы циклический импорт.
 * Используется и `instance.ts` (openapi-fetch), и `authorized-fetch.ts` (эндпоинты
 * без OpenAPI-схемы) — чтобы оба пути одинаково переживали истечение access-токена.
 */

const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refresh";

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

export const setTokens = (access: string, refresh: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
};

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

/** `true` для запросов на сам логин/рефреш — на них 401 не пытаемся лечить рефрешем */
export const isAuthTokenEndpoint = (url: string) =>
  url.includes("/api/auth/token/");

let refreshPromise: Promise<string | null> | null = null;

/**
 * Обновляет access-токен через refresh. Параллельные вызовы (несколько запросов
 * упали в 401 одновременно) переиспользуют один и тот же промис — иначе каждый
 * из них долбил бы `/api/auth/token/refresh/` отдельно.
 * `ROTATE_REFRESH_TOKENS=True` на бэке — сервер при каждом рефреше выдаёт новую
 * пару и протухает старый refresh, поэтому сохраняем оба поля из ответа.
 */
export const refreshAccessToken = (): Promise<string | null> => {
  if (refreshPromise) return refreshPromise;

  const refresh = getRefreshToken();
  if (!refresh) return Promise.resolve(null);

  refreshPromise = fetch(`${ENV.API_BASE_URL}/api/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  })
    .then(async (response) => {
      if (!response.ok) {
        clearTokens();
        return null;
      }
      const data = (await response.json()) as {
        access: string;
        refresh: string;
      };
      setTokens(data.access, data.refresh);
      return data.access;
    })
    .catch(() => {
      clearTokens();
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};
