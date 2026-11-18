import { SearchIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/shared/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

const HAS_PAYMENTS_OPTIONS = [
  { value: "all", label: "Любой договор" },
  { value: "true", label: "Была оплата" },
  { value: "false", label: "Не было оплаты" },
] as const;

export type HasPaymentsFilterValue =
  (typeof HAS_PAYMENTS_OPTIONS)[number]["value"];

// Пороги для `?expiring_within_days=` (бэкенд сам порог не ограничивает,
// варианты — на выбор фронта, см. CurrentStatus.md).
const EXPIRING_OPTIONS = [
  { value: "all", label: "Любой срок" },
  { value: "5", label: "Скоро истекает (5 дн.)" },
  { value: "15", label: "Скоро истекает (15 дн.)" },
  { value: "30", label: "Скоро истекает (30 дн.)" },
] as const;

export type ExpiringWithinDaysFilterValue =
  (typeof EXPIRING_OPTIONS)[number]["value"];

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  hasPaymentsFilter: HasPaymentsFilterValue;
  onHasPaymentsFilterChange: (value: HasPaymentsFilterValue) => void;
  expiringFilter: ExpiringWithinDaysFilterValue;
  onExpiringFilterChange: (value: ExpiringWithinDaysFilterValue) => void;
};

export const ContractsToolbar = ({
  search,
  onSearchChange,
  hasPaymentsFilter,
  onHasPaymentsFilterChange,
  expiringFilter,
  onExpiringFilterChange,
}: Props) => (
  <div className="flex items-center gap-2">
    <InputGroup className="w-[21rem] bg-white">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Поиск по номеру, поставщику, наименованию..."
      />
    </InputGroup>
    <Select
      value={hasPaymentsFilter}
      onValueChange={(v) =>
        onHasPaymentsFilterChange(v as HasPaymentsFilterValue)
      }>
      <SelectTrigger className="w-48 bg-white">
        <SelectValue placeholder="Оплата..." />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectGroup>
          {HAS_PAYMENTS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
    <Select
      value={expiringFilter}
      onValueChange={(v) =>
        onExpiringFilterChange(v as ExpiringWithinDaysFilterValue)
      }>
      <SelectTrigger className="w-56 bg-white">
        <SelectValue placeholder="Срок исполнения..." />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectGroup>
          {EXPIRING_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
);
