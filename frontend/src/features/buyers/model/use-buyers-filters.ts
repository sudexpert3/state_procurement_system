import type { StatusFilterValue } from "@/shared/model/status";

import { useState } from "react";

import { useDebounceValue } from "@siberiacancode/reactuse";

export type BuyersFilters = {
  search?: string;
  isActive?: boolean;
};

export const useBuyersFilters = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const debouncedSearch = useDebounceValue(search, 500);

  const filters: BuyersFilters = {
    search: debouncedSearch || "",
    isActive: statusFilter === "all" ? undefined : statusFilter === "true",
  };

  return {
    filters,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
  };
};
