import type { Department } from "@/shared/api/schema";

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

import { useDepartmentForm } from "../hooks/use-department-form";

import { departmentSchema, type DepartmentValues } from "./department.schema";

type Props = {
  open: boolean;
  item: Department | null;
  allItems: Department[];
  onClose: () => void;
  onSuccess: () => void;
};

const defaultValues: DepartmentValues = {
  full_name: "",
  short_name: "",
  is_active: true,
  parent: null,
};

export const DepartmentForm = ({
  open,
  item,
  allItems,
  onClose,
  onSuccess,
}: Props) => {
  const isEdit = item !== null;
  const portalContainerRef = useRef<HTMLDivElement | null>(null);

  const { submit, isPending } = useDepartmentForm({ item, onClose, onSuccess });

  const formdata: DepartmentValues = {
    ...defaultValues,
    ...item,
    is_active: item?.is_active ?? true,
    parent: item?.parent ?? null,
  };

  const { handleSubmit, control } = useForm<DepartmentValues>({
    resolver: zodResolver(departmentSchema),
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
            {isEdit ? "Редактировать подразделение" : "Добавить подразделение"}
          </DrawerTitle>
        </DrawerHeader>

        <form
          id="department-form"
          onSubmit={handleSubmit(submit)}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
          <Controller
            name="full_name"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-full-name">
                  Полное наименование
                </FieldLabel>
                <Input
                  id="field-full-name"
                  placeholder="Полное наименование подразделения"
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
                  placeholder="Краткое наименование"
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
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Вышестоящее подразделение</FieldLabel>
                <Combobox
                  items={parentOptions}
                  value={
                    parentOptions.find((opt) => opt.id === field.value) ?? null
                  }
                  onValueChange={(val: Department | null) =>
                    field.onChange(val?.id ?? null)
                  }
                  itemToStringLabel={(val) => (val ? val.short_name : "")}>
                  <ComboboxInput
                    placeholder="Поиск по наименованию..."
                    showClear
                    aria-invalid={fieldState.invalid}
                  />
                  <ComboboxContent portalContainer={portalContainerRef}>
                    <ComboboxEmpty>Ничего не найдено</ComboboxEmpty>
                    <ComboboxList>
                      {(department: Department) => (
                        <ComboboxItem key={department.id} value={department}>
                          {department.short_name}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
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
                      <SelectItem value="true">Действующее</SelectItem>
                      <SelectItem value="false">Не действующее</SelectItem>
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
          <Button type="submit" form="department-form" disabled={isPending}>
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
