import type { Supplier } from "@/shared/api/schema";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

import { rqClient } from "@/shared/api/instance";
import { handleHttpError } from "@/shared/lib/handle-http-error";
import { Button } from "@/shared/ui/kit/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/ui/kit/drawer";
import { Field, FieldError, FieldLabel } from "@/shared/ui/kit/field";
import { Input } from "@/shared/ui/kit/input";

const supplierSchema = z.object({
  name: z.string().min(1, "Обязательное поле"),
  unp: z.string().min(1, "Обязательное поле"),
});

type FormValues = z.input<typeof supplierSchema>;

type Props = {
  open: boolean;
  item: Supplier | null;
  onClose: () => void;
  onSuccess: () => void;
};

const defaultValues: FormValues = {
  name: "",
  unp: "",
};

export const SupplierForm = ({ open, item, onClose, onSuccess }: Props) => {
  const isEdit = item !== null;

  const createMutation = rqClient.useMutation("post", "/api/suppliers/");
  const updateMutation = rqClient.useMutation("patch", "/api/suppliers/{id}/");
  const isPending = createMutation.isPending || updateMutation.isPending;

  const { handleSubmit, control } = useForm<FormValues>({
    resolver: zodResolver(supplierSchema),
    values: item ? { name: item.name, unp: item.unp } : defaultValues,
  });

  const handleSuccess = (message: string) => {
    toast.success(message);
    onClose();
    onSuccess();
  };

  const submit = handleSubmit((values) => {
    if (item) {
      updateMutation.mutate(
        { params: { path: { id: item.id } }, body: values },
        {
          onSuccess: () => handleSuccess("Поставщик обновлён"),
          onError: () => toast.error("Не удалось сохранить поставщика"),
        },
      );
    } else {
      createMutation.mutate(
        { body: values },
        {
          onSuccess: () => handleSuccess("Поставщик добавлен"),
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
            {isEdit ? "Редактировать поставщика" : "Добавить поставщика"}
          </DrawerTitle>
        </DrawerHeader>

        <form
          id="supplier-form"
          onSubmit={submit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
          <Controller
            name="name"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-supplier-name">
                  Наименование организации
                </FieldLabel>
                <Input
                  id="field-supplier-name"
                  placeholder="ООО «Пример»"
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
            name="unp"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-supplier-unp">УНП</FieldLabel>
                <Input
                  id="field-supplier-unp"
                  placeholder="123456789"
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </form>

        <DrawerFooter>
          <Button type="submit" form="supplier-form" disabled={isPending}>
            {isPending && <Loader2Icon size={16} className="animate-spin" />}
            {isEdit ? "Сохранить" : "Добавить"}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              Отмена
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
