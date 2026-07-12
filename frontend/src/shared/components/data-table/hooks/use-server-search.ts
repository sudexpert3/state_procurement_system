import { useCallback } from "react";

import { useDebounceValue } from "@siberiacancode/reactuse";
import { useSearchParams } from "react-router";

/**
 * Синхронизирует строку серверного поиска с URL (`?search=`).
 *
 * `search` — мгновенное значение для инпута, `debouncedSearch` — для запроса к API.
 * При изменении поиска сбрасывает `offset`: результаты всегда с первой страницы.
 */
export const useServerSearch = ({ delay = 500 }: { delay?: number } = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const debouncedSearch = useDebounceValue(search, delay);

  const setSearch = useCallback(
    (value: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);

          if (value) {
            params.set("search", value);
          } else {
            params.delete("search");
          }

          params.set("offset", "0");

          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { search, debouncedSearch, setSearch };
};
