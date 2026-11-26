import { useCallback, useState } from "react";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

// Удаление разрешено бэкендом для любого статуса (DRAFT/ACTIVE/ARCHIVE) —
// см. CurrentStatus.md (2026-11-26); отдельная проверка статуса на фронте не нужна.
export const useDepartmentLimitDelete = (invalidate: () => void) => {
  const { mutate } = rqClient.useMutation(
    "delete",
    "/api/department_article_limits/{id}/",
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
            toast.success("Запись удалена");
          },
          onError: (error) => {
            setDeletingId(null);
            handleHttpError(error, "Не удалось удалить запись", true);
          },
        },
      );
    },
    [mutate, invalidate],
  );

  return { handleDelete, deletingId };
};
