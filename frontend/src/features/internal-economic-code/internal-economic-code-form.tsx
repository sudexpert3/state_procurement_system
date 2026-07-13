import type { InternalEconomicCode } from "@/shared/api/schema";

import { useMemo, useRef } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

import { useInternalCodeForm } from "./hooks/use-internal-economic-code-form";
import {
  internalEconomicCodeSchema,
  type InternalEconomicCodeValues,
} from "./internal-economic-code.schema";

type Props = {
  open: boolean;
  item: InternalEconomicCode | null;
  allItems: InternalEconomicCode[];
  onClose: () => void;
  onSuccess: () => void;
};

const defaultValues: InternalEconomicCodeValues = {
  code: "",
  name: "",
  is_active: true,
  parent: null,
};

export const InternalEconomicCodeForm = ({
  open,
  item,
  allItems,
  onClose,
  onSuccess,
}: Props) => {
  const isEdit = item !== null;
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const { submit, isPending } = useInternalCodeForm({
    item,
    onClose,
    onSuccess,
  });

  const formdata: InternalEconomicCodeValues = {
    ...defaultValues,
    ...item,
    is_active: item?.is_active ?? true,
    parent: null,
  };

  const { handleSubmit, control } = useForm<InternalEconomicCodeValues>({
    resolver: zodResolver(internalEconomicCodeSchema),
    values: formdata,
  });

  const parentOptions = useMemo(
    () => allItems.filter((i) => i.id !== item?.id),
    [item?.id, allItems],
  );

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()} direction="right">
      <DrawerContent className="flex flex-col" ref={portalContainerRef}>
        <DrawerHeader>
          <DrawerTitle>
            {isEdit
              ? "Редактировать внутренний код ЭКР"
              : "Добавить внутренний код ЭКР"}
          </DrawerTitle>
        </DrawerHeader>

        <form
          id="internal-economic-code-form"
          onSubmit={handleSubmit(submit)}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
          <Controller
            name="code"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-code">Код ЭКР</FieldLabel>
                <Input
                  id="field-code"
                  placeholder="1101008165"
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
                  placeholder="Наименование (расшифровка кода)"
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
            name="parent"
            control={control}
            render={({ field, fieldState }) => {
              console.log(field);
              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Родительская группа</FieldLabel>
                  <Combobox
                    items={parentOptions}
                    value={
                      parentOptions.find((opt) => opt.id === field.value) ??
                      null
                    }
                    onValueChange={(val: InternalEconomicCode | null) =>
                      field.onChange(val?.id ?? null)
                    }
                    itemToStringLabel={(val) => (val ? val.code : "")}>
                    <ComboboxInput
                      placeholder="Поиск по коду..."
                      showClear
                      aria-invalid={fieldState.invalid}
                    />
                    <ComboboxContent portalContainer={portalContainerRef}>
                      <ComboboxEmpty>Ничего не найдено</ComboboxEmpty>
                      <ComboboxList>
                        {(code: InternalEconomicCode) => (
                          <ComboboxItem key={code.id} value={code}>
                            {code.code} — {code.name}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              );
            }}
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
            form="internal-economic-code-form"
            disabled={isPending}>
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
