import axios from "axios";

import { ENV } from "../model/env";

export const http = axios.create({
  baseURL: ENV.API_BASE_URL,
  withCredentials: true,
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

export const gpzApi = axios.create({
  baseURL: ENV.API_BASE_URL,
});

[http, gpzApi].forEach((instance) =>
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  }),
);

[http, gpzApi].forEach((instance) =>
  instance.interceptors.response.use(
    (config) => config,
    (error) => {},
  ),
);
