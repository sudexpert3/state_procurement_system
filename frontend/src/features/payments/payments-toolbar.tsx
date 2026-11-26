import type { DateRange } from "react-day-picker";
import type { Department, KindOfPayment } from "@/shared/api/schema";

import { useMemo } from "react";

import { SearchIcon } from "lucide-react";

import { rqClient } from "@/shared/api/instance";
import { Button } from "@/shared/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
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

import { PaymentsDateRangeFilter } from "./payments-date-range-filter";

// Узел дерева /api/departments/ — sub_departments в OpenAPI-схеме типизирован
// как string (известный баг бэка, см. CurrentStatus.md), реально всегда
// массив узлов (тот же приём, что в contracts/contracts-toolbar.tsx).
const flattenDepartments = (nodes: Department[]): Department[] =>
  nodes.flatMap((node) => [
    node,
    ...flattenDepartments(
      (node.sub_departments as unknown as Department[] | undefined) ?? [],
    ),
  ]);

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

// Одиночный комбобокс по ID статьи/параграфа/внутреннего кода ЭКР — те же
// источники данных, что и на «Реестре закупок» (registry-filters.tsx), но
// значение — FK id (бэкенд фильтрует `?economic_class=<id>`), а не код-строка.
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
  search: string;
  onSearchChange: (value: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (value: DateRange | undefined) => void;
  quarterFilter: QuarterFilterValue;
  onQuarterFilterChange: (value: QuarterFilterValue) => void;
  yearFilter: number | "all";
  onYearFilterChange: (value: number | "all") => void;
  kindFilter: number | "all";
  onKindFilterChange: (value: number | "all") => void;
  kindOptions: KindOfPayment[];
  economicClassFilter: ClassFilterValue;
  onEconomicClassFilterChange: (value: ClassFilterValue) => void;
  functionalClassFilter: ClassFilterValue;
  onFunctionalClassFilterChange: (value: ClassFilterValue) => void;
  internalEconomicClassFilter: ClassFilterValue;
  onInternalEconomicClassFilterChange: (value: ClassFilterValue) => void;
  departmentsFilter: number[];
  onDepartmentsFilterChange: (value: number[]) => void;
};

export const PaymentsToolbar = ({
  search,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  quarterFilter,
  onQuarterFilterChange,
  yearFilter,
  onYearFilterChange,
  kindFilter,
  onKindFilterChange,
  kindOptions,
  economicClassFilter,
  onEconomicClassFilterChange,
  functionalClassFilter,
  onFunctionalClassFilterChange,
  internalEconomicClassFilter,
  onInternalEconomicClassFilterChange,
  departmentsFilter,
  onDepartmentsFilterChange,
}: Props) => {
  const departmentsAnchor = useComboboxAnchor();

  const { data: functionalCodes, isLoading: isFunctionalLoading } =
    rqClient.useQuery("get", "/api/functional_code/", {});
  const { data: economicCodes, isLoading: isEconomicLoading } =
    rqClient.useQuery("get", "/api/economic_code/", {});
  const { data: internalCodes, isLoading: isInternalLoading } =
    rqClient.useQuery("get", "/api/internal_economic_code/", {});
  const { data: departmentsTree, isLoading: isDepartmentsLoading } =
    rqClient.useQuery("get", "/api/departments/", {
      params: { query: { is_active: true } },
    });

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

  const departmentOptions = useMemo(
    () =>
      flattenDepartments(
        (departmentsTree ?? []) as unknown as Department[],
      ).map((department) => ({
        id: department.id,
        label: department.short_name,
      })),
    [departmentsTree],
  );
  const selectedDepartments = departmentOptions.filter((d) =>
    departmentsFilter.includes(d.id),
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <InputGroup className="w-64 bg-white">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск по примечанию..."
        />
      </InputGroup>
      <PaymentsDateRangeFilter value={dateRange} onChange={onDateRangeChange} />
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
      <Combobox
        items={departmentOptions}
        value={selectedDepartments}
        onValueChange={(items) =>
          onDepartmentsFilterChange(items.map((item) => item.id))
        }
        itemToStringLabel={(item) => item?.label ?? ""}
        itemToStringValue={(item) => (item ? String(item.id) : "")}
        multiple>
        <ComboboxChips ref={departmentsAnchor} className="w-64 bg-white">
          <ComboboxValue>
            {(values: CodeOption[]) => (
              <>
                {values.map((value) => (
                  <ComboboxChip key={value.id}>{value.label}</ComboboxChip>
                ))}
                <ComboboxChipsInput
                  placeholder={
                    isDepartmentsLoading ? "Загрузка..." : "Подразделения..."
                  }
                />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={departmentsAnchor}>
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
    </div>
  );
};
