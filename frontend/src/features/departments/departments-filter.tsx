import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { STATUS_OPTIONS, type StatusFilterValue } from "@/shared/model/status";

type Props = {
  value: StatusFilterValue;
  onValueChange: (value: StatusFilterValue) => void;
};

export const DepartmentsFilter = ({ value, onValueChange }: Props) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger className="w-48 bg-white">
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
