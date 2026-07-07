import { useCallback, useMemo, useState } from "react";

import { useDebounceValue } from "@siberiacancode/reactuse";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";

export const useDepartments = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const debouncedSearch = useDebounceValue(search, 500);

  const query = rqClient.useQuery("get", "/api/departments/", {
    params: {
      query: {
        search: debouncedSearch,
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
    () =>
      queryClient.invalidateQueries({
        queryKey: ["get", "/api/departments/"],
      }),
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
