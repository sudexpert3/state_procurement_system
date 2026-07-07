import type { EconomicClassifier } from "./economic-classifier.page";

import { useMemo, useState } from "react";

import { useDebounceValue } from "@siberiacancode/reactuse";

export function useClassifierSearch(data: EconomicClassifier[]) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounceValue(search, 500);

  // const query = rqClient.useQuery("get", ""); // TODO: добавить запрос, когда бэк отдаст данные

  const filteredData = useMemo(() => {
    if (!debouncedSearch.trim()) return data;

    const q = debouncedSearch.toLowerCase();

    return data.filter(
      (item) =>
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q),
    );
  }, [data, debouncedSearch]);

  return { search, setSearch, filteredData };
}
