import { createBrowserRouter, redirect } from "react-router";

import * as procurements from "@/features/procurements";
import { ROUTES } from "@/shared/model/routes";

import { App } from "./app";
import { MainLayout } from "./main-layout";
import { ProtectedRoute } from "./protected-route";

export const router = createBrowserRouter([
  {
    element: <App />,
    errorElement: <div>ERROR</div>,
    children: [
      {
        Component: ProtectedRoute,
        children: [
          {
            element: <MainLayout />,
            children: [
              {
                path: ROUTES.PROCUREMENTS,
                lazy: procurements.list,
              },
              {
                path: ROUTES.PROCUREMENT,
                lazy: procurements.detail,
              },
              {
                path: ROUTES.PROCUREMENT_ADD,
                lazy: procurements.create,
              },
              {
                path: ROUTES.USERS,
                element: <div>ПОЛЬЗОВАТЕЛИ</div>,
              },
              {
                path: ROUTES.CODES,
                element: <div>Коды ОКРБ</div>,
              },
            ],
          },
        ],
      },
      {
        path: ROUTES.LOGIN,
        lazy: () => import("@/features/auth/login.page"),
      },
      {
        path: ROUTES.HOME,
        loader: () => redirect(ROUTES.PROCUREMENTS),
      },
      {
        path: ROUTES.NOT_FOUND,
        lazy: () => import("@/features/404/not-found.page"),
      },
    ],
  },
]);
