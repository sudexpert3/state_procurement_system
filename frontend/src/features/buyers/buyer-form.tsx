import { useEffect } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import z from "zod";

import { Button } from "@/shared/ui/kit/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/kit/select";
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

const buyerSchema = z.object({
  shot_name: z.string().min(1, "Обязательное поле"),
  full_name: z.string().min(1, "Обязательное поле"),
  is_active: z.boolean(),
});

type FormValues = z.input<typeof buyerSchema>;
export type BuyerFormOutput = z.output<typeof buyerSchema>;

export type BuyerItem = {
  id: number;
  shot_name: string;
  full_name: string;
  is_active: boolean;
};


type Props = {
  open: boolean;
  item: BuyerItem | null;
  onClose: () => void;
  onSubmit: (values: BuyerFormOutput, id?: number) => void;
};

export const BuyerForm = ({ open, item, onClose, onSubmit }: Props) => {
  const isEdit = item !== null;

  const { handleSubmit, control, reset } = useForm<FormValues>({
    resolver: zodResolver(buyerSchema),
    defaultValues: { shot_name: "", full_name: "", is_active: true },
  });

  useEffect(() => {
    if (open) {
      reset(
        item
          ? {
              shot_name: item.shot_name,
              full_name: item.full_name,
              is_active: item.is_active,
            }
          : { shot_name: "", full_name: "", is_active: true },
      );
    }
  }, [open, item, reset]);

  const submit = handleSubmit((values) => {
    onSubmit(values as BuyerFormOutput, item?.id);
    onClose();
  });

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()} direction="right">
      <DrawerContent className="flex flex-col">
        <DrawerHeader>
          <DrawerTitle>
            {isEdit ? "Редактировать закупщика" : "Добавить закупщика"}
          </DrawerTitle>
        </DrawerHeader>

        <form
          onSubmit={submit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
          <Controller
            name="shot_name"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-shot-name">
                  Фамилия и инициалы
                </FieldLabel>
                <Input
                  id="field-shot-name"
                  placeholder="Иванов И.И."
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
            name="full_name"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-full-name">ФИО полностью</FieldLabel>
                <Input
                  id="field-full-name"
                  placeholder="Иванов Иван Иванович"
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
                  <SelectContent>
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
          <Button type="button" onClick={submit}>
            {isEdit ? "Сохранить" : "Добавить"}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
