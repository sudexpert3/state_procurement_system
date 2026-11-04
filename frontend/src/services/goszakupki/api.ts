import type { PushResult, SyncStats } from "./types";

import { useMutation } from "@tanstack/react-query";

import { authorizedFetch } from "@/shared/lib/helpers/authorized-fetch";

export const useSyncAllPurchases = () =>
  useMutation({
    mutationFn: () =>
      authorizedFetch<SyncStats>("/api/gosakupki/get_purchases_all"),
  });

export const useSyncPurchaseItems = () =>
  useMutation({
    mutationFn: (purchaseId: number) =>
      authorizedFetch<SyncStats>(
        `/api/gosakupki/get_purchases_items/${purchaseId}/`,
      ),
  });

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
