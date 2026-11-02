import type { OnChangeFn, PaginationState } from "@tanstack/react-table";

import { useCallback, useMemo } from "react";

import { useSearchParams } from "react-router";

/**
 * Синхронизирует состояние серверной пагинации с URL (`?limit=&offset=`).
 *
 * Возвращает `limit`/`offset` для запроса к API и `pagination`/`onPaginationChange`
 * для `DataTable` в режиме `manual`.
 */
export const useServerPagination = ({
  defaultPageSize = 20,
}: { defaultPageSize?: number } = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const limit = Number(searchParams.get("limit")) || defaultPageSize;
  const offset = Number(searchParams.get("offset")) || 0;

  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: Math.floor(offset / limit), pageSize: limit }),
    [limit, offset],
  );

  const onPaginationChange = useCallback<OnChangeFn<PaginationState>>(
    (updater) => {
      const next =
        typeof updater === "function" ? updater(pagination) : updater;

      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("limit", String(next.pageSize));
          params.set("offset", String(next.pageIndex * next.pageSize));
          return params;
        },
        { replace: true },
      );
    },
    [pagination, setSearchParams],
  );

  return { limit, offset, pagination, onPaginationChange };
};
