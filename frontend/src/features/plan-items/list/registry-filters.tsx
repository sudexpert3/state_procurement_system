import type { Table } from "@tanstack/react-table";
import type { Department, PlanItemShort } from "@/shared/api/schema";

import { useMemo } from "react";

import { rqClient } from "@/shared/api/instance";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

type FacetOption = { id: string; label: string };

type FacetComboboxProps = {
  table: Table<PlanItemShort>;
  columnId: string;
  options: FacetOption[];
  isLoading?: boolean;
  placeholder: string;
  inputClassName?: string;
};

// Значение фильтра живёт в columnFilters таблицы (поднято наружу страницей
// реестра — там же оно превращается в query-параметр запроса к бэкенду,
// см. plans-items.page.tsx), сам комбобокс об этом не знает.
const FacetCombobox = ({
  table,
  columnId,
  options,
  isLoading,
  placeholder,
  inputClassName = "w-56 bg-white",
}: FacetComboboxProps) => {
  const column = table.getColumn(columnId);
  const filterValue = column?.getFilterValue() as string | undefined;
  const selected = options.find((option) => option.id === filterValue) ?? null;

  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(item) => column?.setFilterValue(item?.id)}
      itemToStringLabel={(item) => item?.label ?? ""}
      itemToStringValue={(item) => item?.id ?? ""}>
      <ComboboxInput
        placeholder={isLoading ? "Загрузка..." : placeholder}
        showClear
        disabled={isLoading}
        className={inputClassName}
      />
      <ComboboxContent>
        <ComboboxEmpty>Ничего не найдено</ComboboxEmpty>
        <ComboboxList>
          {(item: FacetOption) => (
            <ComboboxItem key={item.id} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
};

// Узел дерева /api/internal_economic_code/. В OpenAPI-схеме sub_codes
// типизирован как string (известный баг бэка — см. CurrentStatus.md), реально
// всегда массив узлов того же вида (возможно пустой у листьев).
type InternalEconomicNode = {
  code: string;
  name: string;
  sub_codes: unknown;
};

// Присваиваемые коды ЭКР внутренние — только листья дерева (узлы без
// дочерних элементов); промежуточные узлы — группы классификатора, их
// нельзя выбрать как значение internal_economic_class_detail.code.
const flattenLeaves = (nodes: InternalEconomicNode[]): FacetOption[] => {
  const leaves: FacetOption[] = [];

  const visit = (node: InternalEconomicNode) => {
    const children = Array.isArray(node.sub_codes)
      ? (node.sub_codes as InternalEconomicNode[])
      : [];

    if (children.length === 0) {
      leaves.push({ id: node.code, label: `${node.code} — ${node.name}` });
      return;
    }

    children.forEach(visit);
  };

  nodes.forEach(visit);

  return leaves;
};

const sortOptions = (options: FacetOption[]) =>
  [...options].sort((a, b) => a.label.localeCompare(b.label, "ru"));

// Узел дерева /api/departments/ — sub_departments в OpenAPI-схеме тоже
// типизирован как string (тот же известный баг бэка, что и у sub_codes выше),
// реально всегда массив узлов (см. cost-department-drawer.tsx — тот же приём).
const flattenDepartments = (nodes: Department[]): Department[] =>
  nodes.flatMap((node) => [
    node,
    ...flattenDepartments(
      (node.sub_departments as unknown as Department[] | undefined) ?? [],
    ),
  ]);

/** "unset" — пункт "Не определён" (`?buyer_unset=true`), "all" — без фильтра. */
export type BuyerFilterValue = "all" | "unset" | number;
export type DepartmentFilterValue = "all" | number;

/**
 * Категория позиций плана (`?status_category=`, backend — CurrentStatus.md,
 * запись 2026-11-24). "active" — значение по умолчанию, при нём параметр в
 * запрос не отправляется вовсе (совпадает с поведением бэкенда без параметра).
 */
export type StatusCategoryFilterValue =
  | "all"
  | "active"
  | "public"
  | "non_public"
  | "excluded";

const STATUS_CATEGORY_OPTIONS: {
  value: StatusCategoryFilterValue;
  label: string;
}[] = [
  { value: "all", label: "Все" },
  { value: "active", label: "Активная" },
  { value: "public", label: "Публикуемая" },
  { value: "non_public", label: "Не публикуемая" },
  { value: "excluded", label: "Исключена" },
];

type RegistryFiltersProps = {
  table: Table<PlanItemShort>;
  /**
   * Фильтр по исполнителю (`?buyer=<id>` / `?buyer_unset=true`), по
   * подразделению, для которого проводится закупка (`?department=<id>`), и
   * по категории позиции (`?status_category=`) — ни один из них не привязан
   * ни к одной отображаемой колонке реестра, поэтому, в отличие от фильтров
   * по кодам ЭКР выше, управляются явными пропами, а не через
   * `table.getColumn(id).setFilterValue()`.
   */
  buyerFilter: BuyerFilterValue;
  onBuyerFilterChange: (value: BuyerFilterValue) => void;
  departmentFilter: DepartmentFilterValue;
  onDepartmentFilterChange: (value: DepartmentFilterValue) => void;
  statusCategoryFilter: StatusCategoryFilterValue;
  onStatusCategoryFilterChange: (value: StatusCategoryFilterValue) => void;
  /**
   * Чекбокс «Распределение по подразделениям не добавлено»
   * (`?plan_shares_unset=true`, backend — CurrentStatus.md, запись
   * 2026-11-26): позиции, у которых финансирование заведено (есть активная
   * `BudgetCosts`), но ни разу не распределено по держателям (`PlanShare`).
   */
  planSharesUnsetFilter: boolean;
  onPlanSharesUnsetFilterChange: (value: boolean) => void;
};

export const RegistryFilters = ({
  table,
  buyerFilter,
  onBuyerFilterChange,
  departmentFilter,
  onDepartmentFilterChange,
  statusCategoryFilter,
  onStatusCategoryFilterChange,
  planSharesUnsetFilter,
  onPlanSharesUnsetFilterChange,
}: RegistryFiltersProps) => {
  const { data: functionalCodes, isLoading: isFunctionalLoading } =
    rqClient.useQuery("get", "/api/functional_code/", {});
  const { data: economicCodes, isLoading: isEconomicLoading } =
    rqClient.useQuery("get", "/api/economic_code/", {});
  const { data: internalCodes, isLoading: isInternalLoading } =
    rqClient.useQuery("get", "/api/internal_economic_code/", {});
  const { data: buyers, isLoading: isBuyersLoading } = rqClient.useQuery(
    "get",
    "/api/buyers/",
    { params: { query: { is_active: true } } },
  );
  const { data: departmentsTree, isLoading: isDepartmentsLoading } =
    rqClient.useQuery("get", "/api/departments/", {
      params: { query: { is_active: true } },
    });

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
          .map((code) => ({ id: code.code_api, label: code.code_api })),
      ),
    [functionalCodes],
  );

  const economicCodeOptions = useMemo(
    () =>
      sortOptions(
        (economicCodes ?? [])
          .filter((code) => code.is_active !== false)
          .map((code) => ({ id: code.code_api, label: code.code_api })),
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
    <>
      <FacetCombobox
        table={table}
        columnId="functional_code"
        options={functionalCodeOptions}
        isLoading={isFunctionalLoading}
        placeholder="Функциональный код..."
      />
      <FacetCombobox
        table={table}
        columnId="economic_code"
        options={economicCodeOptions}
        isLoading={isEconomicLoading}
        placeholder="Экономический код..."
      />
      <FacetCombobox
        table={table}
        columnId="internal_economic_code"
        options={internalEconomicCodeOptions}
        isLoading={isInternalLoading}
        placeholder="Код ЭКР внутренний..."
        inputClassName="w-[21rem] bg-white"
      />
      <Select
        value={String(buyerFilter)}
        onValueChange={(v) =>
          onBuyerFilterChange(v === "all" || v === "unset" ? v : Number(v))
        }>
        <SelectTrigger className="w-56 bg-white">
          <SelectValue placeholder="Исполнитель..." />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            <SelectItem value="all">Все исполнители</SelectItem>
            <SelectItem value="unset">Не определён</SelectItem>
            {isBuyersLoading ? (
              <SelectItem value="loading" disabled>
                Загрузка...
              </SelectItem>
            ) : (
              (buyers ?? []).map((buyer) => (
                <SelectItem key={buyer.id} value={String(buyer.id)}>
                  {buyer.shot_name}
                </SelectItem>
              ))
            )}
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
      <Select
        value={statusCategoryFilter}
        onValueChange={(v) =>
          onStatusCategoryFilterChange(v as StatusCategoryFilterValue)
        }>
        <SelectTrigger className="w-56 bg-white">
          <SelectValue placeholder="Категория позиции..." />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {STATUS_CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <label className="border-input flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-sm whitespace-nowrap">
        <Checkbox
          checked={planSharesUnsetFilter}
          onCheckedChange={(checked) =>
            onPlanSharesUnsetFilterChange(checked === true)
          }
        />
        Распределение по подразделениям не добавлено
      </label>
    </>
  );
};
