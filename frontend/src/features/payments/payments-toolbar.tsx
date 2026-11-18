import type { KindOfPayment } from "@/shared/api/schema";

import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

const QUARTER_OPTIONS = [
  { value: "Q1", label: "I квартал" },
  { value: "Q2", label: "II квартал" },
  { value: "Q3", label: "III квартал" },
  { value: "Q4", label: "IV квартал" },
] as const;

export type QuarterFilterValue =
  | (typeof QUARTER_OPTIONS)[number]["value"]
  | "all";

// Текущий год ± пара лет назад — реестр содержит в основном платежи
// текущего финансового года, полного справочника годов на бэке нет.
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [currentYear, currentYear - 1, currentYear - 2];

type Props = {
  quarterFilter: QuarterFilterValue;
  onQuarterFilterChange: (value: QuarterFilterValue) => void;
  yearFilter: number | "all";
  onYearFilterChange: (value: number | "all") => void;
  kindFilter: number | "all";
  onKindFilterChange: (value: number | "all") => void;
  kindOptions: KindOfPayment[];
};

export const PaymentsToolbar = ({
  quarterFilter,
  onQuarterFilterChange,
  yearFilter,
  onYearFilterChange,
  kindFilter,
  onKindFilterChange,
  kindOptions,
}: Props) => (
  <div className="flex flex-wrap items-center gap-3">
    {/* Кнопки года/квартала — по аналогии с YearToggle на «Реестре закупок» (plan-items/list/year-toggle.tsx) */}
    <div className="flex flex-wrap gap-1">
      <Button
        type="button"
        size="sm"
        variant={yearFilter === "all" ? "default" : "outline"}
        onClick={() => onYearFilterChange("all")}>
        Все годы
      </Button>
      {YEAR_OPTIONS.map((year) => (
        <Button
          key={year}
          type="button"
          size="sm"
          variant={yearFilter === year ? "default" : "outline"}
          onClick={() => onYearFilterChange(year)}>
          {year}
        </Button>
      ))}
    </div>

    <div className="flex flex-wrap gap-1">
      <Button
        type="button"
        size="sm"
        variant={quarterFilter === "all" ? "default" : "outline"}
        onClick={() => onQuarterFilterChange("all")}>
        Все кварталы
      </Button>
      {QUARTER_OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          size="sm"
          variant={quarterFilter === opt.value ? "default" : "outline"}
          onClick={() => onQuarterFilterChange(opt.value)}>
          {opt.label}
        </Button>
      ))}
    </div>

    <Select
      value={String(kindFilter)}
      onValueChange={(v) =>
        onKindFilterChange(v === "all" ? "all" : Number(v))
      }>
      <SelectTrigger className="w-56 bg-white">
        <SelectValue placeholder="Вид платежа..." />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectGroup>
          <SelectItem value="all">Любой вид платежа</SelectItem>
          {kindOptions.map((kind) => (
            <SelectItem key={kind.id} value={String(kind.id)}>
              {kind.name}
              {kind.is_refund ? " (возврат)" : ""}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
);
