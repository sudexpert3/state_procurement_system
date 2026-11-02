import { useCallback, useState } from "react";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";

export const useCodeOkrbDelete = (invalidate: () => void) => {
  const { mutate } = rqClient.useMutation("delete", "/api/okrb/{id}/");
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
            toast.success("Код ОКРБ удалён");
          },
          onError: () => {
            setDeletingId(null);
            toast.error("Не удалось удалить код ОКРБ");
          },
        },
      );
    },
    [mutate, invalidate],
  );

  return { handleDelete, deletingId };
};
