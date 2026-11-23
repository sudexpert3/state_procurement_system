import type { StatusFilterValue } from "@/shared/model/status";

import { useCallback, useMemo, useState } from "react";

import { useDebounceValue } from "@siberiacancode/reactuse";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";

export const useUnitsOfMeasurement = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const debouncedSearch = useDebounceValue(search, 500);

  const query = rqClient.useQuery("get", "/api/units_of_measurement/", {
    params: {
      query: {
        search: debouncedSearch,
        ...(statusFilter !== "all" && { is_active: statusFilter === "true" }),
      },
    },
  });

  const data = useMemo(() => query.data ?? [], [query.data]);

  const invalidate = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: ["get", "/api/units_of_measurement/"],
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
