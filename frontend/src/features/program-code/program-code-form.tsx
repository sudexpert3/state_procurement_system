import type { ProgramCode } from "@/shared/api/schema";

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
import { Textarea } from "@/shared/components/ui/textarea";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

import {
  programCodeSchema,
  type ProgramCodeValues,
} from "./program-code.schema";

type Props = {
  open: boolean;
  item: ProgramCode | null;
  onClose: () => void;
  onSuccess: () => void;
};

const defaultValues = {
  code_api: "",
  description: "",
  is_active: true,
};

export const ProgramCodeForm = ({ open, item, onClose, onSuccess }: Props) => {
  const isEdit = item !== null;

  const createMutation = rqClient.useMutation("post", "/api/program_code/");
  const updateMutation = rqClient.useMutation(
    "patch",
    "/api/program_code/{id}/",
  );
  const isPending = createMutation.isPending || updateMutation.isPending;

  const formdata = {
    ...defaultValues,
    ...item,
    description: item?.description ?? "",
    is_active: item?.is_active ?? true,
  };

  const { handleSubmit, control } = useForm<ProgramCodeValues>({
    resolver: zodResolver(programCodeSchema),
    values: formdata,
  });

  const handleSuccess = (message: string) => {
    toast.success(message);
    onClose();
    onSuccess();
  };

  const handleError = () => {
    toast.error("Не удалось сохранить программный код");
  };

  const submit = handleSubmit((values) => {
    if (item) {
      updateMutation.mutate(
        { params: { path: { id: item.id } }, body: values },
        {
          onSuccess: () => handleSuccess("Программный код обновлён"),
          onError: handleError,
        },
      );
    } else {
      createMutation.mutate(
        {
          body: { id: 0, ...values },
        },
        {
          onSuccess: () => handleSuccess("Программный код добавлен"),
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
              ? "Редактировать программный код"
              : "Добавить программный код"}
          </DrawerTitle>
        </DrawerHeader>

        <form
          id="program-code-form"
          onSubmit={submit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
          <Controller
            name="code_api"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-code-api">
                  Программный код
                </FieldLabel>
                <Input
                  id="field-code-api"
                  placeholder="99 0"
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
            name="description"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-description">
                  Наименование
                </FieldLabel>
                <Textarea
                  id="field-description"
                  placeholder="99_00"
                  rows={4}
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
          <Button type="submit" form="program-code-form" disabled={isPending}>
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
