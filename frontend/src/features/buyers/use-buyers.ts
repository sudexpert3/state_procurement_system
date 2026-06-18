import { useCallback, useMemo, useState } from "react";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";

export const useBuyers = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const query = rqClient.useQuery("get", "/api/buyers/");

  const data = useMemo(() => {
    let result = query.data ?? [];

    if (statusFilter !== "all") {
      const isActive = statusFilter === "true";
      result = result.filter((item) => item.is_active === isActive);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.shot_name.toLowerCase().includes(q) ||
          item.full_name.toLowerCase().includes(q),
      );
    }

    return result;
  }, [query.data, search, statusFilter]);

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
