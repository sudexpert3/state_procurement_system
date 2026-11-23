import type { RefundFilterValue } from "../kind-of-payment-filter";

import { useCallback, useMemo, useState } from "react";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";

// `/api/kind_of_payment/` не поддерживает ни `search`, ни фильтр по
// `is_refund` (справочник короткий, ~10 записей) — фильтруем на клиенте,
// без дебаунса (нет сетевого запроса на каждое нажатие).
export const useKindOfPayment = () => {
  const [search, setSearch] = useState("");
  const [refundFilter, setRefundFilter] = useState<RefundFilterValue>("all");

  const query = rqClient.useQuery("get", "/api/kind_of_payment/");

  const data = useMemo(() => {
    let result = query.data ?? [];

    if (refundFilter !== "all") {
      const isRefund = refundFilter === "true";
      result = result.filter((item) => Boolean(item.is_refund) === isRefund);
    }

    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      result = result.filter((item) =>
        item.name.toLowerCase().includes(needle),
      );
    }

    return result;
  }, [query.data, refundFilter, search]);

  const invalidate = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: ["get", "/api/kind_of_payment/"],
      }),
    [],
  );

  return {
    search,
    setSearch,
    refundFilter,
    setRefundFilter,
    data,
    isLoading: query.isLoading,
    invalidate,
  };
};
