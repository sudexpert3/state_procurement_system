import { useState } from "react";

import { format } from "date-fns";
import { ChevronDownIcon } from "lucide-react";
import {
  type Control,
  Controller,
  type FieldValues,
  type Path,
} from "react-hook-form";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/kit/button";
import { Calendar } from "@/shared/ui/kit/calendar";
import { Field, FieldError, FieldLabel } from "@/shared/ui/kit/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/kit/popover";

export function DatePickerField<TFieldValues extends FieldValues>({
  label,
  control,
  name,
  placeholder,
  disabled = false,
  className,
  dateFormat = "dd.MM.yyyy",
}: {
  label?: string;
  name: Path<TFieldValues>;
  control: Control<TFieldValues>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  dateFormat?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          className={cn("w-40", className)}
          data-invalid={fieldState.invalid}>
          {label && <FieldLabel htmlFor={name}>{label}</FieldLabel>}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={disabled}
                aria-invalid={fieldState.invalid}
                className="justify-between font-normal">
                {field.value ? format(field.value, dateFormat) : placeholder}
                <ChevronDownIcon />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={field.value}
                onSelect={(date) => {
                  field.onChange(date);
                  setOpen(false);
                }}
                defaultMonth={field.value}
              />
            </PopoverContent>
          </Popover>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}
