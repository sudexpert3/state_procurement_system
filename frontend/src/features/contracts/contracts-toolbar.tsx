import type { Department } from "@/shared/api/schema";

import { useMemo } from "react";

import { SearchIcon } from "lucide-react";

import { rqClient } from "@/shared/api/instance";
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

// Узел дерева /api/departments/ — sub_departments в OpenAPI-схеме типизирован
// как string (известный баг бэка, см. CurrentStatus.md), реально всегда
// массив узлов (тот же приём, что в plan-items/list/registry-filters.tsx).
const flattenDepartments = (nodes: Department[]): Department[] =>
  nodes.flatMap((node) => [
    node,
    ...flattenDepartments(
      (node.sub_departments as unknown as Department[] | undefined) ?? [],
    ),
  ]);

export type DepartmentFilterValue = "all" | number;

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
  departmentFilter: DepartmentFilterValue;
  onDepartmentFilterChange: (value: DepartmentFilterValue) => void;
};

export const ContractsToolbar = ({
  search,
  onSearchChange,
  hasPaymentsFilter,
  onHasPaymentsFilterChange,
  expiringFilter,
  onExpiringFilterChange,
  departmentFilter,
  onDepartmentFilterChange,
}: Props) => {
  const { data: departmentsTree, isLoading: isDepartmentsLoading } =
    rqClient.useQuery("get", "/api/departments/", {
      params: { query: { is_active: true } },
    });

  const departments = useMemo(
    () =>
      flattenDepartments((departmentsTree ?? []) as unknown as Department[]),
    [departmentsTree],
  );

  return (
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
      <Select
        value={String(departmentFilter)}
        onValueChange={(v) =>
          onDepartmentFilterChange(v === "all" ? v : Number(v))
        }>
        <SelectTrigger className="w-56 bg-white">
          <SelectValue placeholder="Подразделение..." />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            <SelectItem value="all">Все подразделения</SelectItem>
            {isDepartmentsLoading ? (
              <SelectItem value="loading" disabled>
                Загрузка...
              </SelectItem>
            ) : (
              departments.map((department) => (
                <SelectItem key={department.id} value={String(department.id)}>
                  {department.short_name}
                </SelectItem>
              ))
            )}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};
