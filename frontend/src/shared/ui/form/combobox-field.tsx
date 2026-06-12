import type { ComboboxRootProps } from "@base-ui/react";

import {
  type Control,
  Controller,
  type FieldValues,
  type Path,
} from "react-hook-form";

import { Field, FieldError, FieldLabel } from "@/shared/ui/kit/field";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "../kit/combobox";

type ComboboxItem = {
  id: number | string;
};

type ComboboxFieldProps<
  TFieldValues extends FieldValues,
  TItem extends ComboboxItem,
> = {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label?: string;
  items: TItem[];
  showClear?: boolean;
  autoHighlight?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  renderItemValue: (item: TItem) => string;
} & Omit<
  ComboboxRootProps<TItem, false>,
  "multiple" | "value" | "onValueChange" | "items"
>;

export const ComboboxField = <
  TFieldValues extends FieldValues,
  TItem extends ComboboxItem,
>({
  control,
  name,
  label,
  items,
  showClear = true,
  autoHighlight = true,
  placeholder,
  className,
  inputClassName,
  renderItemValue,
  ...props
}: ComboboxFieldProps<TFieldValues, TItem>) => {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        return (
          <Field data-invalid={fieldState.invalid} className={className}>
            {label && <FieldLabel>{label}</FieldLabel>}
            <Combobox
              {...props}
              items={items}
              value={items.find((item) => item.id === field.value) ?? null}
              onValueChange={(item) => field.onChange(item?.id)}
              autoHighlight={autoHighlight}>
              <ComboboxInput
                placeholder={placeholder}
                showClear={showClear}
                aria-invalid={fieldState.invalid}
                className={inputClassName}
              />
              <ComboboxContent>
                <ComboboxEmpty>Ничего не найдено</ComboboxEmpty>
                <ComboboxList>
                  {(item: TItem) => (
                    <ComboboxItem key={item.id} value={item}>
                      {renderItemValue(item)}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            {fieldState.invalid && (
              <FieldError>{fieldState.error?.message}</FieldError>
            )}
          </Field>
        );
      }}
    />
  );
};
