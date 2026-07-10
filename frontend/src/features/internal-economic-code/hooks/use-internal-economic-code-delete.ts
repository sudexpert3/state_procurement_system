import { useCallback, useState } from "react";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";

export const useInternalEconomicCodeDelete = (invalidate: () => void) => {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { mutate } = rqClient.useMutation(
    "delete",
    "/api/internal_economic_code/{id}/",
  );
  const handleDelete = useCallback(
    (id: number) => {
      setDeletingId(id);
      mutate(
        { params: { path: { id } } },
        {
          onSuccess: () => {
            setDeletingId(null);
            invalidate();
            toast.success("Внутренний код удалён");
          },
          onError: () => {
            setDeletingId(null);
            toast.error("Не удалось удалить внутренний код");
          },
        },
      );
    },
    [invalidate, mutate],
  );

  return {
    handleDelete,
    deletingId,
  };
};
