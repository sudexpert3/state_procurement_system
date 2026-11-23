import { useCallback, useState } from "react";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";

export const useKindOfPaymentDelete = (invalidate: () => void) => {
  const { mutate } = rqClient.useMutation(
    "delete",
    "/api/kind_of_payment/{id}/",
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = useCallback(
    (id: number) => {
      setDeletingId(id);
      mutate(
        { params: { path: { id } } },
        {
          onSuccess: () => {
            setDeletingId(null);
            invalidate();
            toast.success("Вид платежа удалён");
          },
          onError: () => {
            setDeletingId(null);
            toast.error("Не удалось удалить вид платежа");
          },
        },
      );
    },
    [mutate, invalidate],
  );

  return { handleDelete, deletingId };
};
