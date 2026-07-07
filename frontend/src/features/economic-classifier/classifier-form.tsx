import type { EconomicClassifier } from "./economic-classifier.page";

import { useMemo, useRef } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import z from "zod";

import { Button } from "@/shared/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/components/ui/combobox";
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

const classifierSchema = z.object({
  code: z.string().min(1, "Обязательное поле"),
  name: z.string().min(1, "Обязательное поле"),
  parent_id: z.coerce.number<number>().nullable(),
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

const initialData = { code: "", name: "", parent_id: null };

export const ClassifierForm = ({
  open,
  item,
  allItems,
  onClose,
  onSubmit,
}: Props) => {
  const isEdit = item !== null;
  const portalContainerRef = useRef<HTMLDivElement | null>(null);

  const { handleSubmit, control, reset } = useForm<FormValues>({
    resolver: zodResolver(classifierSchema),
    values: { ...initialData, ...item },
  });

  const parentOptions = useMemo(
    () => allItems.filter((i) => i.id !== item?.id),
    [item?.id, allItems],
  );

  const submit = handleSubmit((values) => {
    onSubmit(values, item?.id);
    reset(initialData);
    onClose();
  });

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()} direction="right">
      <DrawerContent className="flex flex-col" ref={portalContainerRef}>
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
                  items={parentOptions}
                  onValueChange={(val: EconomicClassifier | null) =>
                    field.onChange(val?.id ?? null)
                  }
                  itemToStringLabel={(val) =>
                    val ? `${val.code} — ${val.name}` : ""
                  }>
                  <ComboboxInput
                    placeholder="Поиск по коду или названию..."
                    showClear
                    aria-invalid={fieldState.invalid}
                  />
                  <ComboboxContent portalContainer={portalContainerRef}>
                    <ComboboxList>
                      <ComboboxItem value="">Без родителя</ComboboxItem>
                      {parentOptions.map((opt) => (
                        <ComboboxItem key={opt.id} value={opt}>
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
