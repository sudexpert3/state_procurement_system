import type { BudgetExecutionRow, GeneralMoneyRow } from "./types";

import { useQuery } from "@tanstack/react-query";

import { authorizedFetch } from "@/shared/lib/helpers/authorized-fetch";

export const useGeneralMoneyReportQuery = (year: number) =>
  useQuery({
    queryKey: ["reports", "general_money", year],
    queryFn: () =>
      authorizedFetch<GeneralMoneyRow[]>(
        `/api/reports/general_money/?year=${year}`,
      ),
  });

export const useBudgetExecutionReportQuery = (params: {
  year?: number;
  department?: number;
  quarter?: "Q1" | "Q2" | "Q3" | "Q4";
}) => {
  const search = new URLSearchParams();
  if (params.year) search.set("year", String(params.year));
  if (params.department) search.set("department", String(params.department));
  if (params.quarter) search.set("quarter", params.quarter);
  const queryString = search.toString();

  return useQuery({
    queryKey: ["reports", "budget_execution", queryString],
    queryFn: () =>
      authorizedFetch<BudgetExecutionRow[]>(
        `/api/reports/budget_execution/?${queryString}`,
      ),
  });
};
