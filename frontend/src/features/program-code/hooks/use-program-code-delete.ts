import { useCallback, useState } from "react";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";

export const useProgramCodeDelete = (invalidate: () => void) => {
  const { mutate } = rqClient.useMutation("delete", "/api/program_code/{id}/");
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
            toast.success("Программный код удалён");
          },
          onError: () => {
            setDeletingId(null);
            toast.error("Не удалось удалить программный код");
          },
        },
      );
    },
    [mutate, invalidate],
  );

  return { handleDelete, deletingId };
};
