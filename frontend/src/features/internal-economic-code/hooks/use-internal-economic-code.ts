import type { InternalEconomicCode } from "@/shared/api/schema";
import type { StatusFilterValue } from "@/shared/model/status";

import { useCallback, useMemo, useState } from "react";

import { useDebounceValue } from "@siberiacancode/reactuse";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";

/** Разворачивает дерево кодов в плоский список (для выбора родителя в форме) */
const flattenTree = (nodes: InternalEconomicCode[]): InternalEconomicCode[] =>
  nodes.flatMap((node) => [node, ...flattenTree(node.sub_codes)]);

/**
 * Рекурсивно фильтрует дерево по статусу: узел остаётся, если сам подходит
 * или содержит подходящих потомков (чтобы группа с нужными кодами не пропала)
 */
const filterTreeByStatus = (
  nodes: InternalEconomicCode[],
  isActive: boolean,
): InternalEconomicCode[] =>
  nodes.flatMap((node) => {
    const sub_codes = filterTreeByStatus(node.sub_codes, isActive);
    return node.is_active === isActive || sub_codes.length > 0
      ? [{ ...node, sub_codes }]
      : [];
  });

export const useInternalEconomicCode = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const debouncedSearch = useDebounceValue(search, 500);

  const query = rqClient.useQuery(
    "get",
    "/api/internal_economic_code/",

    {
      params: {
        query: {
          search: debouncedSearch,
        },
      },
    },
  );

  // TODO: временный каст — убрать после доработки бэка (sub_codes в
  // сгенерированной схеме сейчас string вместо массива узлов)
  const tree = useMemo(
    () => (query.data ?? []) as unknown as InternalEconomicCode[],
    [query.data],
  );

  const data = useMemo(
    () =>
      statusFilter === "all"
        ? tree
        : filterTreeByStatus(tree, statusFilter === "true"),
    [tree, statusFilter],
  );

  const flatData = useMemo(() => flattenTree(tree), [tree]);

  const invalidate = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: ["get", "/api/internal_economic_code/"],
      }),
    [],
  );

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    data,
    flatData,
    isLoading: query.isLoading,
    invalidate,
  };
};
