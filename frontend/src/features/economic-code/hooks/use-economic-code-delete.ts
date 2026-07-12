import { useCallback, useState } from "react";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";

export const useEconomicCodeDelete = (invalidate: () => void) => {
  const { mutate } = rqClient.useMutation("delete", "/api/economic_code/{id}/");
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
            toast.success("Код ЭКР удалён");
          },
          onError: () => {
            setDeletingId(null);
            toast.error("Не удалось удалить код ЭКР");
          },
        },
      );
    },
    [mutate, invalidate],
  );

  return { handleDelete, deletingId };
};
