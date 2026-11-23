import { Suspense } from "react";

import { createBrowserRouter, redirect } from "react-router";
import { Toaster } from "sonner";

import * as buyers from "@/features/buyers";
import * as changeRequests from "@/features/change-requests";
import * as codeOkrb from "@/features/code-okrb";
import * as contracts from "@/features/contracts";
import * as departmentLimits from "@/features/department-limits";
import * as departments from "@/features/departments";
import * as economicCode from "@/features/economic-code";
import * as functionalCode from "@/features/functional-code";
import * as internalEconomicCode from "@/features/internal-economic-code";
import * as kindOfPayment from "@/features/kind-of-payment";
import * as payments from "@/features/payments";
import * as planItems from "@/features/plan-items";
import * as plans from "@/features/plans";
import * as programCode from "@/features/program-code";
import * as reports from "@/features/reports";
import * as suppliers from "@/features/suppliers";
import * as unitsOfMeasurement from "@/features/units-of-measurement";
import * as users from "@/features/users";
import { ROUTES } from "@/shared/model/routes";

import { App } from "./app";
import { MainLayout } from "./main-layout";
import { ProtectedRoute } from "./protected-route";
import { Providers } from "./providers";
import { RequireRole } from "./require-role";

export const router = createBrowserRouter([
  {
    element: (
      <Providers>
        <Suspense fallback={<div>Loading...</div>}>
          <App />
          <Toaster position="top-center" richColors />
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
                path: ROUTES.CHANGE_REQUESTS,
                lazy: changeRequests.list,
              },
              {
                path: ROUTES.CONTRACTS,
                lazy: contracts.list,
              },
              {
                path: ROUTES.PAYMENTS,
                lazy: payments.list,
              },
              {
                path: ROUTES.ECONOMIC_CODE,
                lazy: economicCode.list,
              },
              {
                path: ROUTES.FUNCTIONAL_CODE,
                lazy: functionalCode.list,
              },
              {
                path: ROUTES.PROGRAM_CODE,
                lazy: programCode.list,
              },
              {
                path: ROUTES.UNITS_OF_MEASUREMENT,
                lazy: unitsOfMeasurement.list,
              },
              {
                path: ROUTES.KIND_OF_PAYMENT,
                lazy: kindOfPayment.list,
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
              {
                path: ROUTES.INTERNAL_ECONOMIC_CODE,
                lazy: internalEconomicCode.list,
              },
              {
                path: ROUTES.REPORTS,
                loader: () => redirect(ROUTES.REPORTS_GENERAL_MONEY),
              },
              {
                path: ROUTES.REPORTS_GENERAL_MONEY,
                lazy: reports.generalMoney,
              },
              {
                path: ROUTES.REPORTS_BUDGET_EXECUTION,
                lazy: reports.budgetExecution,
              },
              {
                Component: () => <RequireRole role="ADMIN_MAIN" />,
                children: [
                  {
                    path: ROUTES.USERS,
                    lazy: users.list,
                  },
                ],
              },
              {
                Component: () => (
                  <RequireRole role={["ADMIN_MAIN", "FINANCIER"]} />
                ),
                children: [
                  {
                    path: ROUTES.DEPARTMENT_LIMITS,
                    lazy: departmentLimits.list,
                  },
                ],
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
