import { useCallback, useState } from "react";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

export const useUserDelete = (invalidate: () => void) => {
  const { mutate } = rqClient.useMutation("delete", "/api/users/{id}/");
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
            toast.success("Пользователь удалён");
          },
          onError: (error) => {
            setDeletingId(null);
            handleHttpError(error, "Не удалось удалить пользователя", true);
          },
        },
      );
    },
    [mutate, invalidate],
  );

  return { handleDelete, deletingId };
};
