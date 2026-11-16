import type { ApiPaths } from "./schema";

import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";

import { ENV } from "@/shared/model/env";
import { ROUTES } from "@/shared/model/routes";

import {
  clearTokens,
  getAccessToken,
  isAuthTokenEndpoint,
  refreshAccessToken,
} from "./auth-tokens";

export const fetchClient = createFetchClient<ApiPaths>({
  baseUrl: ENV.API_BASE_URL,
});

export const rqClient = createClient(fetchClient);

// Клон исходного запроса на случай рефреша токена и повтора — сохраняется в
// onRequest, ПОКА тело запроса ещё не "прочитано" отправкой (после этого
// Request.clone() упал бы). Ключ — id запроса из самого openapi-fetch,
// совпадает между onRequest/onResponse/onError одного и того же вызова.
const pendingRequests = new Map<string, Request>();

fetchClient.use({
  async onRequest({ request, id }) {
    const token = getAccessToken();

    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    pendingRequests.set(id, request.clone());
    return request;
  },

  async onResponse({ response, request, id }) {
    const originalRequest = pendingRequests.get(id);
    pendingRequests.delete(id);

    if (response.status === 401 && !isAuthTokenEndpoint(request.url)) {
      const newAccessToken = await refreshAccessToken();

      if (newAccessToken && originalRequest) {
        const retryRequest = new Request(originalRequest);
        retryRequest.headers.set("Authorization", `Bearer ${newAccessToken}`);
        return fetch(retryRequest);
      }

      clearTokens();
      window.location.assign(ROUTES.LOGIN);
      return response;
    }

    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const body = await response.json();
        if (typeof body?.message === "string") {
          message = body.message;
        } else if (body && typeof body === "object") {
          const flat = Object.values(body).flat();
          if (flat.length > 0 && flat.every((e) => typeof e === "string")) {
            message = flat.join(", ");
          }
        }
      } catch {}
      throw new Error(message);
    }
  },

  async onError({ id }) {
    pendingRequests.delete(id);
  },
});
