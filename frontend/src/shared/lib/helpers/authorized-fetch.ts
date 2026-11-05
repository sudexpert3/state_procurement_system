import { ENV } from "@/shared/model/env";

/**
 * fetch с Bearer-токеном для эндпоинтов, которые drf-spectacular не смог описать
 * (plain APIView без serializer_class — см. doc/frontend_handoff.md, раздел 8:
 * /api/reports/*, /api/gosakupki/*, /api/goszakupki/*). Для них openapi-fetch
 * бесполезен — generated-тип не даёт ни параметров, ни формы ответа.
 */
export const authorizedFetch = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const token = localStorage.getItem("token");

  const response = await fetch(`${ENV.API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body: unknown = await response.json();
      if (
        body &&
        typeof body === "object" &&
        "message" in body &&
        typeof body.message === "string"
      ) {
        message = body.message;
      } else if (
        body &&
        typeof body === "object" &&
        "detail" in body &&
        typeof body.detail === "string"
      ) {
        message = body.detail;
      } else if (
        // /api/gosakupki/*, /api/goszakupki/* на ошибках отдают {"error": "..."}
        // (см. views/get_data_from_goszakupki.py, views/plan_sync.py), а не
        // message/detail, как остальной API.
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string"
      ) {
        message = body.error;
      }
    } catch {
      // тело ответа не JSON — оставляем статусную строку
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
};
