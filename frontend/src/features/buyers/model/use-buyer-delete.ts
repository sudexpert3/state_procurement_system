import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";

import { buyerKeys } from "../buyer-keys";

export const useBuyerDelete = () => {
  const deleteBuyerMutation = rqClient.useMutation(
    "delete",
    "/api/buyers/{id}/",
    {
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: buyerKeys.list(),
        });
      },
    },
  );

  const deleteBuyer = (id: number) => {
    deleteBuyerMutation.mutate(
      { params: { path: { id } } },
      {
        onSuccess: () => {
          toast.success("Закупщик удалён");
        },
        onError: () => {
          toast.error("Не удалось удалить закупщика", { richColors: true });
        },
      },
    );
  };

  return {
    deleteBuyer,
    getDeletingId: (buyerId: number) =>
      deleteBuyerMutation.isPending &&
      deleteBuyerMutation.variables?.params.path.id === buyerId,
  };
};
