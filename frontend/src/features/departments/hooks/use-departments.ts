import type { Department } from "@/shared/api/schema";
import type { StatusFilterValue } from "@/shared/model/status";

import { useCallback, useMemo, useState } from "react";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";

/** Разворачивает дерево подразделений в плоский список (для выбора родителя в форме) */
const flattenTree = (nodes: Department[]): Department[] =>
  nodes.flatMap((node) => [node, ...flattenTree(node.sub_departments)]);

/**
 * Рекурсивно фильтрует дерево по статусу: узел остаётся, если сам подходит
 * или содержит подходящих потомков (чтобы группа с нужными подразделениями не пропала)
 */
const filterTreeByStatus = (
  nodes: Department[],
  isActive: boolean,
): Department[] =>
  nodes.flatMap((node) => {
    const sub_departments = filterTreeByStatus(node.sub_departments, isActive);
    return node.is_active === isActive || sub_departments.length > 0
      ? [{ ...node, sub_departments }]
      : [];
  });

export const useDepartments = () => {
  // Поиск клиентский — фильтрует сам tanstack-table (globalFilter)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");

  const query = rqClient.useQuery("get", "/api/departments/");

  // TODO: временный каст — убрать после доработки бэка (sub_departments в
  // сгенерированной схеме сейчас string вместо массива узлов)
  const tree = useMemo(
    () => (query.data ?? []) as unknown as Department[],
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
    flatData,
    isLoading: query.isLoading,
    invalidate,
  };
};
