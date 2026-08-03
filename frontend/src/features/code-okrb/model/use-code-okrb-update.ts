import type { CodeOkrbValues } from "../code-okrb.schema";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";

import { codeOkrbKeys } from "../code-okrb-keys";

export const useCodeOkrbUpdate = (onClose: () => void) => {
  const updateMutation = rqClient.useMutation("patch", "/api/okrb/{id}/", {
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: codeOkrbKeys.list(),
      }),
  });

  const updateCodeOkrb = (id: number, values: CodeOkrbValues) => {
    updateMutation.mutate(
      { params: { path: { id } }, body: values },
      {
        onSuccess: () => {
          toast.success("Код ОКРБ обновлён");
          onClose();
        },
        onError: () => toast.error("Не удалось сохранить код ОКРБ"),
      },
    );
  };

  return {
    updateCodeOkrb,
    isPending: updateMutation.isPending,
  };
};
