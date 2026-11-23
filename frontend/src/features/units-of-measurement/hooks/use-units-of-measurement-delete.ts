import { useCallback, useState } from "react";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";

export const useUnitsOfMeasurementDelete = (invalidate: () => void) => {
  const { mutate } = rqClient.useMutation(
    "delete",
    "/api/units_of_measurement/{id}/",
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
            toast.success("Единица измерения удалена");
          },
          onError: () => {
            setDeletingId(null);
            toast.error("Не удалось удалить единицу измерения");
          },
        },
      );
    },
    [mutate, invalidate],
  );

  return { handleDelete, deletingId };
};
