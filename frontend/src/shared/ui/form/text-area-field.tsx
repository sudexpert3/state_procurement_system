import type { TextareaHTMLAttributes } from "react";

import {
  type Control,
  Controller,
  type FieldValues,
  type Path,
} from "react-hook-form";

import { Field, FieldError, FieldLabel } from "../kit/field";
import { RequiredField } from "../kit/required-field";
import { Textarea } from "../kit/textarea";

export const TextAreaField = <TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  className,
  inputClassName,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label?: string;
  inputClassName?: string;
}) => {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        return (
          <Field data-invalid={fieldState.invalid} className={className}>
            {label && (
              <FieldLabel>
                {label} {required && <RequiredField />}
              </FieldLabel>
            )}
            <Textarea
              aria-invalid={fieldState.invalid}
              {...props}
              {...field}
              className={inputClassName}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        );
      }}
    />
  );
};
