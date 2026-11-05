import type { PushResult, SyncAllResult, SyncItemsResult } from "./types";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryClient } from "@/shared/api/query-client";
import { authorizedFetch } from "@/shared/lib/helpers/authorized-fetch";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

export const useSyncAllPurchases = () =>
  useMutation({
    mutationFn: () =>
      authorizedFetch<SyncAllResult>("/api/gosakupki/get_purchases_all"),
  });

export const useSyncPurchaseItems = () =>
  useMutation({
    mutationFn: (purchaseId: number) =>
      authorizedFetch<SyncItemsResult>(
        `/api/gosakupki/get_purchases_items/${purchaseId}/`,
      ),
  });

/**
 * Синхронизация позиций одного плана (кнопка-стрелка на "Годовых планах" и
 * кнопка "Синхронизировать позиции с ЭТП" на "Реестре закупок") — общая
 * обработка результата (toast + инвалидация кеша позиций), чтобы поведение
 * не расходилось между двумя местами использования.
 */
export const useSyncPurchaseItemsAction = () => {
  const mutation = useSyncPurchaseItems();

  const sync = (purchaseId: number) => {
    mutation.mutate(purchaseId, {
      onSuccess: (stats) => {
        if (stats.status === "success" && stats.details) {
          toast.success(
            `Позиции плана синхронизированы: ${stats.details.imported_plan_item_count} новых, ${stats.details.updated_plan_item_count} обновлено, ${stats.details.skiped_plan_item_count} пропущено`,
          );
          queryClient.invalidateQueries({
            queryKey: ["get", "/api/plan_items/"],
          });
        } else {
          toast.info(stats.message);
        }
      },
      onError: (error) =>
        handleHttpError(
          error,
          "Не удалось синхронизировать позиции плана",
          true,
        ),
    });
  };

  return {
    sync,
    isPending: mutation.isPending,
    syncingPurchaseId: mutation.isPending ? (mutation.variables ?? null) : null,
  };
};

export const usePushPlanItems = () =>
  useMutation({
    mutationFn: (planItemIds: number[]) =>
      authorizedFetch<PushResult>("/api/goszakupki/push-plan-items/", {
        method: "POST",
        body: JSON.stringify({ plan_item_ids: planItemIds }),
      }),
  });

export const useDeletePlanItems = () =>
  useMutation({
    mutationFn: (planItemIds: number[]) =>
      authorizedFetch<PushResult>("/api/goszakupki/delete-plan-items/", {
        method: "POST",
        body: JSON.stringify({ plan_item_ids: planItemIds }),
      }),
  });
