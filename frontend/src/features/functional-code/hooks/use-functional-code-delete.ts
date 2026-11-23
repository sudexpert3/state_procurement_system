import { useCallback, useState } from "react";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";

export const useFunctionalCodeDelete = (invalidate: () => void) => {
  const { mutate } = rqClient.useMutation(
    "delete",
    "/api/functional_code/{id}/",
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
            toast.success("Функциональный код удалён");
          },
          onError: () => {
            setDeletingId(null);
            toast.error("Не удалось удалить функциональный код");
          },
        },
      );
    },
    [mutate, invalidate],
  );

  return { handleDelete, deletingId };
};
