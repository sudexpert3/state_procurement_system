import type { CodeOkrbFilters } from "./use-code-okrb-filters";

import { useMemo } from "react";

import { rqClient } from "@/shared/api/instance";

export const useCodeOkrb = ({ search, isActive }: CodeOkrbFilters) => {
  const query = rqClient.useQuery("get", "/api/okrb/", {
    params: {
      query: {
        search,
        is_active: isActive,
      },
    },
  });

  const data = useMemo(() => query.data ?? [], [query.data]);

  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
};
