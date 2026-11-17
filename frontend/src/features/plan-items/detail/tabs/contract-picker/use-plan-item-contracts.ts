import { useState } from "react";

import { rqClient } from "@/shared/api/instance";

/**
 * Список договоров, привязанных к пункту плана (`GET /api/contracts/?plan_item=`,
 * фильтр добавлен бэкендом 2026-11-17, см. CurrentStatus.md), + выбор договора
 * для табов «Договоры»/«Платежи»: 0 договоров — пусто, 1 — выбирается сам,
 * больше одного — выбор по клику в списке (см. ContractPickerList).
 */
export const usePlanItemContracts = (planItemId: number) => {
  const query = rqClient.useQuery("get", "/api/contracts/", {
    params: { query: { plan_item: planItemId, limit: 1000 } },
  });
  const contracts = query.data?.results ?? [];

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedContract =
    contracts.length === 1
      ? contracts[0]
      : (contracts.find((c) => c.id === selectedId) ?? null);

  return {
    contracts,
    isLoading: query.isLoading,
    selectedContract: selectedContract ?? null,
    setSelectedId,
  };
};
