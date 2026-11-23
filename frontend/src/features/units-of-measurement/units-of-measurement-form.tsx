import type { UnitOfMeasurement } from "@/shared/api/schema";

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
  unitOfMeasurementSchema,
  type UnitOfMeasurementValues,
} from "./units-of-measurement.schema";

type Props = {
  open: boolean;
  item: UnitOfMeasurement | null;
  onClose: () => void;
  onSuccess: () => void;
};

const defaultValues = {
  code: "",
  short_name: "",
  is_active: true,
};

export const UnitOfMeasurementForm = ({
  open,
  item,
  onClose,
  onSuccess,
}: Props) => {
  const isEdit = item !== null;

  const createMutation = rqClient.useMutation(
    "post",
    "/api/units_of_measurement/",
  );
  const updateMutation = rqClient.useMutation(
    "patch",
    "/api/units_of_measurement/{id}/",
  );
  const isPending = createMutation.isPending || updateMutation.isPending;

  const formdata = {
    ...defaultValues,
    ...item,
    is_active: item?.is_active ?? true,
  };

  const { handleSubmit, control } = useForm<UnitOfMeasurementValues>({
    resolver: zodResolver(unitOfMeasurementSchema),
    values: formdata,
  });

  const handleSuccess = (message: string) => {
    toast.success(message);
    onClose();
    onSuccess();
  };

  const handleError = () => {
    toast.error("Не удалось сохранить единицу измерения");
  };

  const submit = handleSubmit((values) => {
    if (item) {
      updateMutation.mutate(
        { params: { path: { id: item.id } }, body: values },
        {
          onSuccess: () => handleSuccess("Единица измерения обновлена"),
          onError: handleError,
        },
      );
    } else {
      createMutation.mutate(
        {
          body: { id: 0, ...values },
        },
        {
          onSuccess: () => handleSuccess("Единица измерения добавлена"),
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
            {isEdit
              ? "Редактировать единицу измерения"
              : "Добавить единицу измерения"}
          </DrawerTitle>
        </DrawerHeader>

        <form
          id="units-of-measurement-form"
          onSubmit={submit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
          <Controller
            name="code"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-code">Код ОКРБ 008-95</FieldLabel>
                <Input
                  id="field-code"
                  placeholder="0642"
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
            name="short_name"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-short-name">
                  Краткое наименование
                </FieldLabel>
                <Input
                  id="field-short-name"
                  placeholder="шт."
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
            name="is_active"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Статус</FieldLabel>
                <Select
                  name={field.name}
                  value={String(field.value)}
                  onValueChange={(val) => field.onChange(val === "true")}>
                  <SelectTrigger aria-invalid={fieldState.invalid}>
                    <SelectValue placeholder="Выберите статус" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      <SelectItem value="true">Действующий</SelectItem>
                      <SelectItem value="false">Не действующий</SelectItem>
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
            form="units-of-measurement-form"
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
