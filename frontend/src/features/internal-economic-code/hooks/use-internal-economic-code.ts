import type { InternalEconomicCode } from "@/shared/api/schema";

import { useCallback, useMemo, useState } from "react";

import { useDebounceValue } from "@siberiacancode/reactuse";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";

/** Строка таблицы: узел дерева + уровень вложенности для отступа */
export type InternalEconomicCodeRow = InternalEconomicCode & {
  level: number;
};

/** Разворачивает дерево кодов в плоский список (группа, затем её sub_codes) */
const flattenTree = (
  nodes: InternalEconomicCode[],
  level = 0,
): InternalEconomicCodeRow[] =>
  nodes.flatMap((node) => [
    { ...node, level },
    ...flattenTree(node.sub_codes, level + 1),
  ]);

export const useInternalEconomicCode = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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

  const data = useMemo(() => {
    // TODO: временный каст — убрать после доработки бэка (sub_codes в
    // сгенерированной схеме сейчас string вместо массива узлов)
    const tree = (query.data ?? []) as unknown as InternalEconomicCode[];
    let result = flattenTree(tree);

    if (statusFilter !== "all") {
      const isActive = statusFilter === "true";
      result = result.filter((item) => item.is_active === isActive);
    }

    return result;
  }, [query.data, statusFilter]);

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
    isLoading: query.isLoading,
    invalidate,
  };
};
