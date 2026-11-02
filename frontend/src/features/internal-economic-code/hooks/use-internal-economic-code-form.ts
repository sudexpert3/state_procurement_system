import type { InternalEconomicCode } from "@/shared/api/schema";
import type { InternalEconomicCodeValues } from "../internal-economic-code.schema";

import { useCallback } from "react";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

type InternalEconomicCodeBody = InternalEconomicCode & {
  parent?: number | null;
};

type Params = {
  item: InternalEconomicCode | null;
  onClose: () => void;
  onSuccess: () => void;
};

export const useInternalCodeForm = ({ item, onClose, onSuccess }: Params) => {
  const createMutation = rqClient.useMutation(
    "post",
    "/api/internal_economic_code/",
  );
  const updateMutation = rqClient.useMutation(
    "patch",
    "/api/internal_economic_code/{id}/",
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
    (values: InternalEconomicCodeValues) => {
      if (item) {
        updateMutation.mutate(
          {
            params: { path: { id: item.id } },
            body: values as InternalEconomicCodeBody,
          },
          {
            onSuccess: () => handleSuccess("Внутренний код ЭКР обновлён"),
            onError: (error) =>
              handleHttpError(
                error,
                "Не удалось обновить внутренний код",
                true,
              ),
          },
        );
      } else {
        createMutation.mutate(
          {
            body: {
              id: 0,
              sub_codes: "",
              ...values,
            } as InternalEconomicCodeBody,
          },
          {
            onSuccess: () => handleSuccess("Внутренний код ЭКР добавлен"),
            onError: (error) =>
              handleHttpError(error, "Не удалось создать внутренний код", true),
          },
        );
      }
    },
    [item, createMutation, updateMutation, handleSuccess],
  );

  return { submit, isPending };
};
