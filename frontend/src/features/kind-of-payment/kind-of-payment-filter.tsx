import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

export type RefundFilterValue = "all" | "true" | "false";

const REFUND_OPTIONS: { value: RefundFilterValue; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "false", label: "Обычные" },
  { value: "true", label: "Возвраты" },
];

type Props = {
  value: RefundFilterValue;
  onValueChange: (value: RefundFilterValue) => void;
};

export const KindOfPaymentFilter = ({ value, onValueChange }: Props) => (
  <Select
    value={value}
    onValueChange={(v) => onValueChange(v as RefundFilterValue)}>
    <SelectTrigger className="w-48 bg-white">
      <SelectValue placeholder="Тип..." />
    </SelectTrigger>
    <SelectContent position="popper">
      <SelectGroup>
        {REFUND_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectGroup>
    </SelectContent>
  </Select>
);
