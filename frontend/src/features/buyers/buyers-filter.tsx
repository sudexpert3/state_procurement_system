import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/kit/select";

const STATUS_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "true", label: "Действующие" },
  { value: "false", label: "Не действующие" },
];

type Props = {
  value: string;
  onValueChange: (value: string) => void;
};

export const BuyersFilter = ({ value, onValueChange }: Props) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger className="w-48">
      <SelectValue placeholder="Статус..." />
    </SelectTrigger>
    <SelectContent position="popper">
      <SelectGroup>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectGroup>
    </SelectContent>
  </Select>
);
