import type { DateRange } from "react-day-picker";

import { useState } from "react";

import { format } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";

type Props = {
  value: DateRange | undefined;
  onChange: (value: DateRange | undefined) => void;
};

// `?payment_date_after=`/`?payment_date_before=` (бэкенд добавил 2026-11-18,
// см. CurrentStatus.md) — обе границы включительно. Самостоятельный Popover +
// Calendar(mode="range"), не DatePickerField (тот завязан на react-hook-form,
// здесь обычный фильтр тулбара, как quarterFilter/yearFilter рядом).
export const PaymentsDateRangeFilter = ({ value, onChange }: Props) => {
  const [open, setOpen] = useState(false);

  const label = value?.from
    ? value.to
      ? `${format(value.from, "dd.MM.yyyy")} — ${format(value.to, "dd.MM.yyyy")}`
      : format(value.from, "dd.MM.yyyy")
    : "Период...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-56 justify-between bg-white font-normal">
          {label}
          <CalendarIcon className="text-muted-foreground" size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          defaultMonth={value?.from}
          numberOfMonths={2}
        />
        {value?.from && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}>
              <XIcon size={14} />
              Сбросить период
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
