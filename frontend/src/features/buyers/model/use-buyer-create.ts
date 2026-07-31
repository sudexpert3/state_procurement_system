import type { BuyerValues } from "../buyer.schema";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

import { buyerKeys } from "../buyer-keys";

export const useBuyerCreate = (onClose: () => void) => {
  const createMutation = rqClient.useMutation("post", "/api/buyers/", {
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: buyerKeys.list(),
      });
    },
  });

  const createBuyer = (values: BuyerValues) => {
    createMutation.mutate(
      {
        body: { id: 0, ...values },
      },
      {
        onSuccess: () => {
          toast.success("Закупщик добавлен");
          onClose();
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось создать запись", true),
      },
    );
  };

  return {
    createBuyer,
    isPending: createMutation.isPending,
  };
};
