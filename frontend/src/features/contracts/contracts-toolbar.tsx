import type { Department } from "@/shared/api/schema";

import { useMemo } from "react";

import { SearchIcon } from "lucide-react";

import { rqClient } from "@/shared/api/instance";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/components/ui/combobox";
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

type CodeOption = { id: number; label: string };

const sortOptions = (options: CodeOption[]) =>
  [...options].sort((a, b) => a.label.localeCompare(b.label, "ru"));

// Узел дерева /api/internal_economic_code/ — sub_codes в OpenAPI-схеме тоже
// типизирован как string (тот же известный баг), реально массив узлов.
type InternalEconomicNode = {
  id: number;
  code: string;
  name: string;
  sub_codes: unknown;
};

const flattenLeaves = (nodes: InternalEconomicNode[]): CodeOption[] => {
  const leaves: CodeOption[] = [];

  const visit = (node: InternalEconomicNode) => {
    const children = Array.isArray(node.sub_codes)
      ? (node.sub_codes as InternalEconomicNode[])
      : [];

    if (children.length === 0) {
      leaves.push({ id: node.id, label: `${node.code} — ${node.name}` });
      return;
    }

    children.forEach(visit);
  };

  nodes.forEach(visit);

  return leaves;
};

/** Фильтр по ID (`?economic_class=`/`?functional_class=`/`?internal_economic_class=`), "all" — без фильтра. */
export type ClassFilterValue = "all" | number;

// Одиночный комбобокс по ID статьи/параграфа/внутреннего кода ЭКР (через
// спецификацию договора) — те же источники данных, что на «Реестре закупок»
// (registry-filters.tsx), но значение — FK id, а не код-строка.
const ClassCombobox = ({
  value,
  onValueChange,
  options,
  isLoading,
  placeholder,
}: {
  value: ClassFilterValue;
  onValueChange: (value: ClassFilterValue) => void;
  options: CodeOption[];
  isLoading?: boolean;
  placeholder: string;
}) => {
  const selected =
    value === "all" ? null : (options.find((o) => o.id === value) ?? null);

  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(item) => onValueChange(item?.id ?? "all")}
      itemToStringLabel={(item) => item?.label ?? ""}
      itemToStringValue={(item) => (item ? String(item.id) : "")}>
      <ComboboxInput
        placeholder={isLoading ? "Загрузка..." : placeholder}
        showClear
        disabled={isLoading}
        className="w-56 bg-white"
      />
      <ComboboxContent>
        <ComboboxEmpty>Ничего не найдено</ComboboxEmpty>
        <ComboboxList>
          {(item: CodeOption) => (
            <ComboboxItem key={item.id} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
};

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
  economicClassFilter: ClassFilterValue;
  onEconomicClassFilterChange: (value: ClassFilterValue) => void;
  functionalClassFilter: ClassFilterValue;
  onFunctionalClassFilterChange: (value: ClassFilterValue) => void;
  internalEconomicClassFilter: ClassFilterValue;
  onInternalEconomicClassFilterChange: (value: ClassFilterValue) => void;
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
  economicClassFilter,
  onEconomicClassFilterChange,
  functionalClassFilter,
  onFunctionalClassFilterChange,
  internalEconomicClassFilter,
  onInternalEconomicClassFilterChange,
}: Props) => {
  const { data: departmentsTree, isLoading: isDepartmentsLoading } =
    rqClient.useQuery("get", "/api/departments/", {
      params: { query: { is_active: true } },
    });
  const { data: functionalCodes, isLoading: isFunctionalLoading } =
    rqClient.useQuery("get", "/api/functional_code/", {});
  const { data: economicCodes, isLoading: isEconomicLoading } =
    rqClient.useQuery("get", "/api/economic_code/", {});
  const { data: internalCodes, isLoading: isInternalLoading } =
    rqClient.useQuery("get", "/api/internal_economic_code/", {});

  const departments = useMemo(
    () =>
      flattenDepartments((departmentsTree ?? []) as unknown as Department[]),
    [departmentsTree],
  );

  const functionalCodeOptions = useMemo(
    () =>
      sortOptions(
        (functionalCodes ?? [])
          .filter((code) => code.is_active !== false)
          .map((code) => ({ id: code.id, label: code.code_api })),
      ),
    [functionalCodes],
  );

  const economicCodeOptions = useMemo(
    () =>
      sortOptions(
        (economicCodes ?? [])
          .filter((code) => code.is_active !== false)
          .map((code) => ({ id: code.id, label: code.code_api })),
      ),
    [economicCodes],
  );

  const internalEconomicCodeOptions = useMemo(
    () =>
      sortOptions(
        flattenLeaves(
          (internalCodes ?? []) as unknown as InternalEconomicNode[],
        ),
      ),
    [internalCodes],
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
      <ClassCombobox
        value={functionalClassFilter}
        onValueChange={onFunctionalClassFilterChange}
        options={functionalCodeOptions}
        isLoading={isFunctionalLoading}
        placeholder="Параграф..."
      />
      <ClassCombobox
        value={economicClassFilter}
        onValueChange={onEconomicClassFilterChange}
        options={economicCodeOptions}
        isLoading={isEconomicLoading}
        placeholder="Статья ЭКР..."
      />
      <ClassCombobox
        value={internalEconomicClassFilter}
        onValueChange={onInternalEconomicClassFilterChange}
        options={internalEconomicCodeOptions}
        isLoading={isInternalLoading}
        placeholder="Код ЭКР внутренний..."
      />
    </div>
  );
};
