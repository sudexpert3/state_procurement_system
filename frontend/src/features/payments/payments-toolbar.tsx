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

type Props = {
  quarterFilter: QuarterFilterValue;
  onQuarterFilterChange: (value: QuarterFilterValue) => void;
};

export const PaymentsToolbar = ({
  quarterFilter,
  onQuarterFilterChange,
}: Props) => (
  <Select
    value={quarterFilter}
    onValueChange={(v) => onQuarterFilterChange(v as QuarterFilterValue)}>
    <SelectTrigger className="w-48 bg-white">
      <SelectValue placeholder="Квартал..." />
    </SelectTrigger>
    <SelectContent position="popper">
      <SelectGroup>
        <SelectItem value="all">Все кварталы</SelectItem>
        {QUARTER_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectGroup>
    </SelectContent>
  </Select>
);
