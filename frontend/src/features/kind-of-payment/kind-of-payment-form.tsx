import type { KindOfPayment } from "@/shared/api/schema";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { Button } from "@/shared/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { Field, FieldError, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

import {
  kindOfPaymentSchema,
  type KindOfPaymentValues,
} from "./kind-of-payment.schema";

type Props = {
  open: boolean;
  item: KindOfPayment | null;
  onClose: () => void;
  onSuccess: () => void;
};

const defaultValues = {
  name: "",
  is_refund: false,
};

export const KindOfPaymentForm = ({
  open,
  item,
  onClose,
  onSuccess,
}: Props) => {
  const isEdit = item !== null;

  const createMutation = rqClient.useMutation("post", "/api/kind_of_payment/");
  const updateMutation = rqClient.useMutation(
    "patch",
    "/api/kind_of_payment/{id}/",
  );
  const isPending = createMutation.isPending || updateMutation.isPending;

  const formdata = {
    ...defaultValues,
    ...item,
    is_refund: item?.is_refund ?? false,
  };

  const { handleSubmit, control } = useForm<KindOfPaymentValues>({
    resolver: zodResolver(kindOfPaymentSchema),
    values: formdata,
  });

  const handleSuccess = (message: string) => {
    toast.success(message);
    onClose();
    onSuccess();
  };

  const handleError = () => {
    toast.error("Не удалось сохранить вид платежа");
  };

  const submit = handleSubmit((values) => {
    if (item) {
      updateMutation.mutate(
        { params: { path: { id: item.id } }, body: values },
        {
          onSuccess: () => handleSuccess("Вид платежа обновлён"),
          onError: handleError,
        },
      );
    } else {
      createMutation.mutate(
        {
          body: { id: 0, ...values },
        },
        {
          onSuccess: () => handleSuccess("Вид платежа добавлен"),
          onError: (error) =>
            handleHttpError(error, "Не удалось создать запись", true),
        },
      );
    }
  });

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()} direction="right">
      <DrawerContent className="flex flex-col">
        <DrawerHeader>
          <DrawerTitle>
            {isEdit ? "Редактировать вид платежа" : "Добавить вид платежа"}
          </DrawerTitle>
        </DrawerHeader>

        <form
          id="kind-of-payment-form"
          onSubmit={submit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
          <Controller
            name="name"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-name">
                  Название вида платежа
                </FieldLabel>
                <Input
                  id="field-name"
                  placeholder="Публикуемая часть"
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="is_refund"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Тип</FieldLabel>
                <Select
                  name={field.name}
                  value={String(field.value)}
                  onValueChange={(val) => field.onChange(val === "true")}>
                  <SelectTrigger aria-invalid={fieldState.invalid}>
                    <SelectValue placeholder="Выберите тип" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      <SelectItem value="false">Обычный</SelectItem>
                      <SelectItem value="true">
                        Возврат (уменьшает фактический расход)
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </form>

        <DrawerFooter>
          <Button
            type="submit"
            form="kind-of-payment-form"
            disabled={isPending}>
            {isPending && <Loader2Icon size={16} className="animate-spin" />}
            {isEdit ? "Сохранить" : "Добавить"}
          </Button>
          <DrawerClose asChild>
            <Button
              variant="destructive"
              onClick={onClose}
              disabled={isPending}>
              Отмена
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
