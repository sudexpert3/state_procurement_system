import { useCallback, useState } from "react";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";

export const usePaymentsDelete = (invalidate: () => void) => {
  const { mutate } = rqClient.useMutation("delete", "/api/payments/{id}/");
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
            toast.success("Платёж удалён");
          },
          onError: () => {
            setDeletingId(null);
            toast.error("Не удалось удалить платёж");
          },
        },
      );
    },
    [mutate, invalidate],
  );

  return { handleDelete, deletingId };
};
