import type { ComboboxRootProps } from "@base-ui/react";

import {
  type Control,
  Controller,
  type FieldValues,
  type Path,
} from "react-hook-form";

import { cn } from "@/shared/lib/utils";
import { Field, FieldError, FieldLabel } from "@/shared/ui/kit/field";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "../kit/combobox";

type ComboboxItem = {
  id: string | number;
  value: string;
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
  chipsClassName?: string;
  className?: string;
} & Omit<ComboboxRootProps<TItem, true>, "value" | "onValueChange" | "items">;

export const ComboboxMultipleField = <
  TFieldValues extends FieldValues,
  TItem extends ComboboxItem,
>({
  control,
  name,
  label,
  items,
  showClear,
  autoHighlight,
  placeholder,
  chipsClassName,
  className,
  ...props
}: ComboboxFieldProps<TFieldValues, TItem>) => {
  const anchor = useComboboxAnchor();

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
              value={field.value ?? []}
              onValueChange={field.onChange}
              autoHighlight={autoHighlight}
              multiple>
              <ComboboxChips
                ref={anchor}
                className={cn("w-full max-w-xs", chipsClassName)}>
                <ComboboxValue>
                  {(values: TItem[]) => (
                    <>
                      {values.map((value) => (
                        <ComboboxChip key={value.id}>
                          {value.value}
                        </ComboboxChip>
                      ))}
                      <ComboboxChipsInput />
                    </>
                  )}
                </ComboboxValue>
              </ComboboxChips>
              <ComboboxContent anchor={anchor}>
                <ComboboxEmpty>Ничего не найдено</ComboboxEmpty>
                <ComboboxList>
                  {(item: TItem) => (
                    <ComboboxItem key={item.id} value={item}>
                      {item.value}
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
