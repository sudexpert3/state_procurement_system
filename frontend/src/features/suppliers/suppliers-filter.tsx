import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

export type UnpFilterValue = "all" | "missing";

const UNP_OPTIONS: { value: UnpFilterValue; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "missing", label: "Не указан УНП" },
];

type Props = {
  value: UnpFilterValue;
  onValueChange: (value: UnpFilterValue) => void;
};

export const SuppliersFilter = ({ value, onValueChange }: Props) => (
  <Select
    value={value}
    onValueChange={(v) => onValueChange(v as UnpFilterValue)}>
    <SelectTrigger className="w-48 bg-white">
      <SelectValue placeholder="УНП..." />
    </SelectTrigger>
    <SelectContent position="popper">
      <SelectGroup>
        {UNP_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectGroup>
    </SelectContent>
  </Select>
);
