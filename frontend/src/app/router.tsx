import { Suspense } from "react";

import { createBrowserRouter, redirect } from "react-router";
import { Toaster } from "sonner";

import * as buyers from "@/features/buyers";
import * as codeOkrb from "@/features/code-okrb";
import * as departments from "@/features/departments";
import * as economicClassifier from "@/features/economic-classifier";
import * as planItems from "@/features/plan-items";
import * as plans from "@/features/plans";
import * as suppliers from "@/features/suppliers";
import { ROUTES } from "@/shared/model/routes";

import { App } from "./app";
import { MainLayout } from "./main-layout";
import { ProtectedRoute } from "./protected-route";
import { Providers } from "./providers";

export const router = createBrowserRouter([
  {
    element: (
      <Providers>
        <Suspense fallback={<div>Loading...</div>}>
          <App />
          <Toaster />
        </Suspense>
      </Providers>
    ),
    errorElement: <div>ERROR</div>,
    children: [
      {
        Component: ProtectedRoute,
        children: [
          {
            element: <MainLayout />,
            children: [
              {
                path: ROUTES.PLANS,
                lazy: plans.list,
              },
              {
                path: ROUTES.PLAN_ITEMS,
                lazy: planItems.list,
              },
              {
                path: ROUTES.PLAN_ITEM,
                lazy: planItems.detail,
              },
              {
                path: ROUTES.PLAN_ITEM_ADD,
                lazy: planItems.create,
              },
              {
                path: ROUTES.ECONOMIC_CLASSIFIER,
                lazy: economicClassifier.list,
              },
              {
                path: ROUTES.DEPARTMENTS,
                lazy: departments.list,
              },
              {
                path: ROUTES.BUYERS,
                lazy: buyers.list,
              },
              {
                path: ROUTES.SUPPLIERS,
                lazy: suppliers.list,
              },
              {
                path: ROUTES.CODES_OKRB,
                lazy: codeOkrb.list,
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
        loader: () => redirect(ROUTES.PLANS),
      },
      {
        path: ROUTES.NOT_FOUND,
        lazy: () => import("@/features/404/not-found.page"),
      },
    ],
  },
]);
