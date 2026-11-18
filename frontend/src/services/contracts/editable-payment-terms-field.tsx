import { useState } from "react";

import { Loader2Icon, PencilIcon } from "lucide-react";
import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
import { Button } from "@/shared/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Textarea } from "@/shared/components/ui/textarea";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

type Props = {
  contractId: number;
  paymentTerms: string | null;
  /** Прямое редактирование — роли ADMIN_MAIN/FINANCIER, см. core/choices.py */
  canEdit: boolean;
};

// Drawer справа — тот же паттерн, что и у остальных точечных правок
// (EditablePlannedCostField, EditableBuyerField), для единообразия интерфейса.
export const EditablePaymentTermsField = ({
  contractId,
  paymentTerms,
  canEdit,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(paymentTerms ?? "");

  const mutation = rqClient.useMutation("patch", "/api/contracts/{id}/");

  const openDrawer = () => {
    setValue(paymentTerms ?? "");
    setOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    mutation.mutate(
      {
        params: { path: { id: contractId } },
        body: { payment_terms: value || null },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ["get", "/api/contracts/"],
          });
          toast.success("Условия оплаты сохранены");
          setOpen(false);
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось сохранить условия оплаты", true),
      },
    );
  };

  return (
    <span className="flex items-center gap-1">
      Условия оплаты: <span className="font-bold">{paymentTerms ?? "—"}</span>
      {canEdit && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-5"
          onClick={openDrawer}>
          <PencilIcon size={12} className="text-muted-foreground" />
        </Button>
      )}
      <Drawer open={open} onOpenChange={setOpen} direction="right">
        <DrawerContent className="flex flex-col">
          <DrawerHeader>
            <DrawerTitle>Изменить условия оплаты</DrawerTitle>
          </DrawerHeader>

          <form
            id="payment-terms-form"
            onSubmit={submit}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
            <Field>
              <FieldLabel>Условия оплаты</FieldLabel>
              <Textarea
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Например: оплата 1 раз в квартал по 18 150,0 р."
              />
            </Field>
          </form>

          <DrawerFooter>
            <Button
              type="submit"
              form="payment-terms-form"
              disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2Icon size={16} className="animate-spin" />
              )}
              Сохранить
            </Button>
            <DrawerClose asChild>
              <Button type="button" variant="outline">
                Отмена
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </span>
  );
};
