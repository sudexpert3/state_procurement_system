import { useCallback, useState } from "react";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";

export const useDepartmentDelete = (invalidate: () => void) => {
  const { mutate } = rqClient.useMutation("delete", "/api/departments/{id}/");
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
            toast.success("Подразделение удалено");
          },
          onError: () => {
            setDeletingId(null);
            toast.error("Не удалось удалить подразделение");
          },
        },
      );
    },
    [mutate, invalidate],
  );

  return { handleDelete, deletingId };
};
