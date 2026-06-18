import type { EconomicClassifier } from "./economic-classifier.page";

import { useMemo, useState } from "react";

export function useClassifierSearch(data: EconomicClassifier[]) {
  const [search, setSearch] = useState("");

  // const query = rqClient.useQuery("get", ""); // TODO: добавить запрос, когда бэк отдаст данные

  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (item) =>
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q),
    );
  }, [data, search]);

  return { search, setSearch, filteredData };
}
