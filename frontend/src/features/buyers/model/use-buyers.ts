import type { BuyersFilters } from "./use-buyers-filters";

import { useMemo } from "react";

import { rqClient } from "@/shared/api/instance";

export const useBuyers = ({ search, isActive }: BuyersFilters) => {
  const query = rqClient.useQuery("get", "/api/buyers/", {
    params: {
      query: {
        search,
        is_active: isActive,
      },
    },
  });

  const data = useMemo(() => {
    if (query.error) {
      throw new Error("Что-то пошло не так");
    }
    return query.data ?? [];
  }, [query.data]);

  return {
    data,
    isLoading: query.isLoading,
  };
};
