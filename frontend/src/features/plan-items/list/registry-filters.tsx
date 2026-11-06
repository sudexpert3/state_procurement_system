import type { Table } from "@tanstack/react-table";
import type { PlanItemShort } from "@/shared/api/schema";

import { useMemo } from "react";

import { rqClient } from "@/shared/api/instance";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/components/ui/combobox";

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

type RegistryFiltersProps = { table: Table<PlanItemShort> };

export const RegistryFilters = ({ table }: RegistryFiltersProps) => {
  const { data: functionalCodes, isLoading: isFunctionalLoading } =
    rqClient.useQuery("get", "/api/functional_code/", {});
  const { data: economicCodes, isLoading: isEconomicLoading } =
    rqClient.useQuery("get", "/api/economic_code/", {});
  const { data: internalCodes, isLoading: isInternalLoading } =
    rqClient.useQuery("get", "/api/internal_economic_code/", {});

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
    </>
  );
};
