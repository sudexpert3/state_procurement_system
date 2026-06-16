import type { EconomicClassifier } from "./economic-classifier.page";

import { useEffect } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import z from "zod";

import { Button } from "@/shared/ui/kit/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/ui/kit/combobox";
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

const classifierSchema = z.object({
  code: z.string().min(1, "Обязательное поле"),
  name: z.string().min(1, "Обязательное поле"),
  parent_id: z.preprocess(
    (val) =>
      val === "" || val === null || val === undefined ? null : Number(val),
    z.number().nullable(),
  ),
});

type FormValues = z.input<typeof classifierSchema>;
export type ClassifierFormOutput = z.output<typeof classifierSchema>;

type Props = {
  open: boolean;
  item: EconomicClassifier | null;
  allItems: EconomicClassifier[];
  onClose: () => void;
  onSubmit: (values: ClassifierFormOutput, id?: number) => void;
};

export const ClassifierForm = ({
  open,
  item,
  allItems,
  onClose,
  onSubmit,
}: Props) => {
  const isEdit = item !== null;

  const { handleSubmit, control, reset } = useForm<FormValues>({
    resolver: zodResolver(classifierSchema),
    defaultValues: { code: "", name: "", parent_id: null },
  });

  useEffect(() => {
    if (open) {
      reset(
        item
          ? { code: item.code, name: item.name, parent_id: item.parent_id }
          : { code: "", name: "", parent_id: null },
      );
    }
  }, [open, item, reset]);

  const parentOptions = allItems.filter((i) => i.id !== item?.id);

  const submit = handleSubmit((values) => {
    onSubmit(values as ClassifierFormOutput, item?.id);
    onClose();
  });

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()} direction="right">
      <DrawerContent className="flex flex-col">
        <DrawerHeader>
          <DrawerTitle>
            {isEdit ? "Редактировать классификатор" : "Добавить классификатор"}
          </DrawerTitle>
        </DrawerHeader>

        <form
          onSubmit={submit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
          <Controller
            name="code"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-code">Код</FieldLabel>
                <Input
                  id="field-code"
                  placeholder="Например: 211"
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
            name="name"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-name">Наименование</FieldLabel>
                <Input
                  id="field-name"
                  placeholder="Наименование классификатора"
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
            name="parent_id"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Родительский классификатор</FieldLabel>
                <Combobox
                  value={field.value === null ? "" : String(field.value)}
                  onValueChange={(val) =>
                    field.onChange(val === "" ? null : val)
                  }>
                  <ComboboxInput
                    placeholder="Поиск по коду или названию..."
                    showClear
                    aria-invalid={fieldState.invalid}
                  />
                  <ComboboxContent>
                    <ComboboxList>
                      <ComboboxItem value="">Без родителя</ComboboxItem>
                      {parentOptions.map((opt) => (
                        <ComboboxItem key={opt.id} value={String(opt.id)}>
                          {opt.code} — {opt.name}
                        </ComboboxItem>
                      ))}
                      <ComboboxEmpty>Ничего не найдено</ComboboxEmpty>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
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
