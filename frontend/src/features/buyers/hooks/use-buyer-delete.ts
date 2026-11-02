import { useCallback, useState } from "react";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";

export const useBuyerDelete = (invalidate: () => void) => {
  const { mutate } = rqClient.useMutation("delete", "/api/buyers/{id}/");
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
            toast.success("Закупщик удалён");
          },
          onError: () => {
            setDeletingId(null);
            toast.error("Не удалось удалить закупщика");
          },
        },
      );
    },
    [mutate, invalidate],
  );

  return { handleDelete, deletingId };
};
