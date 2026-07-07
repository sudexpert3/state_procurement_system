import type { Department } from "@/shared/api/schema";
import type { DepartmentValues } from "../form/department.schema";

import { useCallback } from "react";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

type Params = {
  item: Department | null;
  onClose: () => void;
  onSuccess: () => void;
};

export const useDepartmentForm = ({ item, onClose, onSuccess }: Params) => {
  const createMutation = rqClient.useMutation("post", "/api/departments/");
  const updateMutation = rqClient.useMutation(
    "patch",
    "/api/departments/{id}/",
  );
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSuccess = useCallback(
    (message: string) => {
      toast.success(message);
      onClose();
      onSuccess();
    },
    [onClose, onSuccess],
  );

  const submit = useCallback(
    (values: DepartmentValues) => {
      if (item) {
        updateMutation.mutate(
          { params: { path: { id: item.id } }, body: values },
          {
            onSuccess: () => handleSuccess("Подразделение обновлено"),
            onError: (error) =>
              handleHttpError(error, "Не удалось обновить подразделение", true),
          },
        );
      } else {
        createMutation.mutate(
          { body: { id: 0, is_root: false, ...values } },
          {
            onSuccess: () => handleSuccess("Подразделение добавлено"),
            onError: (error) =>
              handleHttpError(error, "Не удалось создать подразделение", true),
          },
        );
      }
    },
    [item, createMutation, updateMutation, handleSuccess],
  );

  return { submit, isPending };
};
