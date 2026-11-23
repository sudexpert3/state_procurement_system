import type { UnpFilterValue } from "./suppliers-filter";

import { useCallback, useMemo, useState } from "react";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";

export const useSuppliers = () => {
  const [search, setSearch] = useState("");
  const [unpFilter, setUnpFilter] = useState<UnpFilterValue>("all");

  const query = rqClient.useQuery("get", "/api/suppliers/");

  const data = useMemo(() => {
    let result = query.data ?? [];

    if (unpFilter === "missing") {
      result = result.filter((item) => !item.unp);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.unp?.toLowerCase().includes(q) ?? false),
      );
    }

    return result;
  }, [query.data, search, unpFilter]);

  const invalidate = useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: ["get", "/api/suppliers/"] }),
    [],
  );

  return {
    search,
    setSearch,
    unpFilter,
    setUnpFilter,
    data,
    isLoading: query.isLoading,
    invalidate,
  };
};
