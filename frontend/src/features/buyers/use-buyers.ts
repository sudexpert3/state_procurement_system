import { useCallback, useMemo, useState } from "react";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";

export const useBuyers = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const query = rqClient.useQuery("get", "/api/buyers/", {
    params: {
      query: {
        search,
      },
    },
  });

  const data = useMemo(() => {
    let result = query.data ?? [];

    if (statusFilter !== "all") {
      const isActive = statusFilter === "true";
      result = result.filter((item) => item.is_active === isActive);
    }

    return result;
  }, [query.data, statusFilter]);

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["get", "/api/buyers/"] }),
    [],
  );

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    data,
    isLoading: query.isLoading,
    invalidate,
  };
};
