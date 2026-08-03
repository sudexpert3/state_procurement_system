import type { OkrbProduct } from "@/shared/api/schema";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

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

import { codeOkrbSchema, type CodeOkrbValues } from "./code-okrb.schema";

type Props = {
  item: OkrbProduct | null;
  onSubmit: (values: CodeOkrbValues) => void;
  disabled: boolean;
};

export const CodeOkrbForm = ({ item, onSubmit, disabled }: Props) => {
  const formValues: CodeOkrbValues = {
    code: item?.code ?? "",
    title: item?.title ?? "",
    is_active: item?.is_active ?? true,
  };

  const { handleSubmit, control } = useForm<CodeOkrbValues>({
    resolver: zodResolver(codeOkrbSchema),
    values: formValues,
  });

  return (
    <form
      id="code-okrb-form"
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
      <Controller
        name="code"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="field-code">Код ОКРБ 007</FieldLabel>
            <Input
              id="field-code"
              placeholder="62.01.11.900"
              aria-invalid={fieldState.invalid}
              disabled={disabled}
              {...field}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name="title"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="field-title">Наименование</FieldLabel>
            <Input
              id="field-title"
              placeholder="Наименование группировки/вида продукции"
              aria-invalid={fieldState.invalid}
              disabled={disabled}
              {...field}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name="is_active"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="field-status">Статус</FieldLabel>
            <Select
              name={field.name}
              value={String(field.value)}
              onValueChange={(value) => field.onChange(value === "true")}
              disabled={disabled}>
              <SelectTrigger
                id="field-status"
                aria-invalid={fieldState.invalid}>
                <SelectValue placeholder="Выберите статус" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  <SelectItem value="true">Действующий</SelectItem>
                  <SelectItem value="false">Не действующий</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </form>
  );
};
