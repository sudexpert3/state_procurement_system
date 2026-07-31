import type { Buyer } from "@/shared/api/schema";

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

import { buyerSchema, type BuyerValues } from "./buyer.schema";

type Props = {
  item: Buyer | null;
  onSubmit: (values: BuyerValues) => void;
};

const defaultValues = {
  shot_name: "",
  full_name: "",
  is_active: true,
};

export const BuyerForm = ({ item, onSubmit }: Props) => {
  const formdata = {
    ...defaultValues,
    ...item,
    is_active: item?.is_active ?? true,
  };

  const { handleSubmit, control } = useForm<BuyerValues>({
    resolver: zodResolver(buyerSchema),
    values: formdata,
  });
  return (
    <form
      id="buyer-form"
      onSubmit={handleSubmit(onSubmit)}
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
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
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
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
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
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </form>
  );
};
