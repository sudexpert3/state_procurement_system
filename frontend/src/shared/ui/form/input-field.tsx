import type { InputHTMLAttributes } from "react";

import {
  type Control,
  Controller,
  type FieldValues,
  type Path,
} from "react-hook-form";

import { Field, FieldError, FieldLabel } from "../kit/field";
import { Input } from "../kit/input";
import { RequiredField } from "../kit/required-field";

export const InputField = <TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label?: string;
  className?: string;
  inputClassName?: string;
}) => {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        return (
          <Field data-invalid={fieldState.invalid} className={props.className}>
            {label && (
              <FieldLabel>
                {label} {required && <RequiredField />}
              </FieldLabel>
            )}
            <Input
              aria-invalid={fieldState.invalid}
              {...props}
              {...field}
              className={props.inputClassName}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        );
      }}
    />
  );
};
