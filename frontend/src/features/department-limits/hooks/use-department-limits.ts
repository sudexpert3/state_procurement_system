import type { DepartmentArticleLimitStatus } from "@/shared/api/schema";

import { useCallback } from "react";

import { keepPreviousData } from "@tanstack/react-query";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";

export const LIST_QUERY_KEY = ["get", "/api/department_article_limits/"];

export type DepartmentLimitsFilters = {
  year: number;
  status?: DepartmentArticleLimitStatus;
  functional_class?: number;
  economic_class?: number;
  department?: number;
  internal_economic_class?: number;
};

export const useDepartmentLimits = (
  filters: DepartmentLimitsFilters,
  pagination: { limit: number; offset: number },
) =>
  rqClient.useQuery(
    "get",
    "/api/department_article_limits/",
    { params: { query: { ...filters, ...pagination } } },
    { placeholderData: keepPreviousData },
  );

export const useInvalidateDepartmentLimits = () =>
  useCallback(
    () => queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY }),
    [],
  );
