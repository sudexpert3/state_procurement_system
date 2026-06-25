import { useCallback, useMemo, useState } from "react";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";

export const useSuppliers = () => {
  const [search, setSearch] = useState("");

  const query = rqClient.useQuery("get", "/api/suppliers/");

  const data = useMemo(() => {
    const result = query.data ?? [];
    if (!search.trim()) return result;

    const q = search.toLowerCase();
    return result.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.unp.toLowerCase().includes(q),
    );
  }, [query.data, search]);

  const invalidate = useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: ["get", "/api/suppliers/"] }),
    [],
  );

  return {
    search,
    setSearch,
    data,
    isLoading: query.isLoading,
    invalidate,
  };
};
