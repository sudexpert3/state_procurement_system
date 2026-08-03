import type { CodeOkrbValues } from "../code-okrb.schema";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

import { codeOkrbKeys } from "../code-okrb-keys";

export const useCodeOkrbCreate = (onClose: () => void) => {
  const createMutation = rqClient.useMutation("post", "/api/okrb/", {
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: codeOkrbKeys.list(),
      }),
  });

  const createCodeOkrb = (values: CodeOkrbValues) => {
    createMutation.mutate(
      {
        // TODO: удалить id после исправления request-схемы на бэкенде.
        body: { id: 0, ...values },
      },
      {
        onSuccess: () => {
          toast.success("Код ОКРБ добавлен");
          onClose();
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось создать запись", true),
      },
    );
  };

  return {
    createCodeOkrb,
    isPending: createMutation.isPending,
  };
};
