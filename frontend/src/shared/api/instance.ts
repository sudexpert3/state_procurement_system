import type { ApiPaths } from "./schema";

import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";

import { ENV } from "@/shared/model/env";

export const fetchClient = createFetchClient<ApiPaths>({
  baseUrl: ENV.API_BASE_URL,
});

export const rqClient = createClient(fetchClient);

fetchClient.use({
  async onRequest({ request }) {
    const token = localStorage.getItem("token");

    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    //!секция будет для рефреша токена
    return request;
  },

  async onResponse({ response }) {
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
});
