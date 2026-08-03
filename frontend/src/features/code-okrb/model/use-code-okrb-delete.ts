import { useCallback } from "react";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";

import { codeOkrbKeys } from "../code-okrb-keys";

export const useCodeOkrbDelete = () => {
  const deleteMutation = rqClient.useMutation("delete", "/api/okrb/{id}/", {
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: codeOkrbKeys.list(),
      }),
  });
  const { isPending, mutate, variables } = deleteMutation;

  const deleteCodeOkrb = useCallback(
    (id: number) => {
      mutate(
        { params: { path: { id } } },
        {
          onSuccess: () => toast.success("Код ОКРБ удалён"),
          onError: () =>
            toast.error("Не удалось удалить код ОКРБ", { richColors: true }),
        },
      );
    },
    [mutate],
  );

  const getDeletingId = useCallback(
    (id: number) => isPending && variables?.params.path.id === id,
    [isPending, variables],
  );

  return {
    deleteCodeOkrb,
    getDeletingId,
  };
};
