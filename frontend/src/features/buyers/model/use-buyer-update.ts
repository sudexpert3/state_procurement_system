import type { BuyerValues } from "../buyer.schema";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";

import { buyerKeys } from "../buyer-keys";

export const useBuyerUpdate = (onClose: () => void) => {
  const updateMutation = rqClient.useMutation("patch", "/api/buyers/{id}/", {
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: buyerKeys.list(),
      });
    },
  });

  const updateBuyer = (id: number, values: BuyerValues) => {
    updateMutation.mutate(
      { params: { path: { id } }, body: values },
      {
        onSuccess: () => {
          toast.success("Закупщик обновлён");
          onClose();
        },
        onError: () => toast.error("Не удалось сохранить закупщика"),
      },
    );
  };

  return {
    updateBuyer,
    isPending: updateMutation.isPending,
  };
};
