import type {
  Department,
  DepartmentArticleLimitStatus,
  InternalEconomicCode,
} from "@/shared/api/schema";

import { useMemo, useRef } from "react";

import { rqClient } from "@/shared/api/instance";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/components/ui/combobox";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

import { flattenDepartments, flattenInternalCodeLeaves } from "./flatten-tree";

export type StatusFilterValue = "all" | DepartmentArticleLimitStatus;

const STATUS_FILTER_OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "ACTIVE", label: "Действующий" },
  { value: "ARCHIVE", label: "Архив" },
  { value: "DRAFT", label: "Черновик" },
];

// Только id (не целые объекты) — переживает сериализацию в URL/localStorage
// при персисте фильтров (см. department-limits.page.tsx), полные объекты для
// отображения в Combobox резолвятся здесь же из уже загруженных справочников.
export type DepartmentLimitsFiltersValue = {
  year: number;
  functionalClassId: number | null;
  economicClassId: number | null;
  departmentId: number | null;
  internalEconomicClassId: number | null;
  status: StatusFilterValue;
};

type Props = {
  value: DepartmentLimitsFiltersValue;
  onChange: (value: DepartmentLimitsFiltersValue) => void;
};

export const DepartmentLimitsFilters = ({ value, onChange }: Props) => {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);

  const functionalCodeQuery = rqClient.useQuery(
    "get",
    "/api/functional_code/",
    { params: { query: { is_active: true } } },
  );
  const economicCodeQuery = rqClient.useQuery("get", "/api/economic_code/", {
    params: { query: { is_active: true } },
  });
  const departmentsQuery = rqClient.useQuery("get", "/api/departments/", {
    params: { query: { is_active: true } },
  });
  const internalCodeQuery = rqClient.useQuery(
    "get",
    "/api/internal_economic_code/",
    {},
  );

  const departments = useMemo(
    () =>
      flattenDepartments(
        // TODO: убрать приведение после исправления sub_departments в OpenAPI.
        (departmentsQuery.data ?? []) as unknown as Department[],
      ),
    [departmentsQuery.data],
  );
  const internalCodeLeaves = useMemo(
    () =>
      flattenInternalCodeLeaves(
        // TODO: убрать приведение после исправления sub_codes в OpenAPI.
        (internalCodeQuery.data ?? []) as unknown as InternalEconomicCode[],
      ),
    [internalCodeQuery.data],
  );

  const functionalClass =
    (functionalCodeQuery.data ?? []).find(
      (c) => c.id === value.functionalClassId,
    ) ?? null;
  const economicClass =
    (economicCodeQuery.data ?? []).find(
      (c) => c.id === value.economicClassId,
    ) ?? null;
  const department =
    departments.find((d) => d.id === value.departmentId) ?? null;
  const internalEconomicClass =
    internalCodeLeaves.find((c) => c.id === value.internalEconomicClassId) ??
    null;

  const patch = (next: Partial<DepartmentLimitsFiltersValue>) =>
    onChange({ ...value, ...next });

  return (
    <div className="flex flex-col gap-2" ref={portalContainerRef}>
      <div className="flex flex-wrap items-center gap-4">
        <Input
          type="number"
          value={value.year}
          onChange={(e) => patch({ year: Number(e.target.value) })}
          className="w-32 bg-white"
        />

        <Combobox
          items={functionalCodeQuery.data ?? []}
          value={functionalClass}
          onValueChange={(v) => patch({ functionalClassId: v?.id ?? null })}
          itemToStringLabel={(c) => (c ? `${c.code_api} ${c.description}` : "")}
          itemToStringValue={(c) => (c ? String(c.id) : "")}>
          <ComboboxInput
            placeholder="Параграф: все..."
            showClear
            className="w-[35rem] bg-white"
          />
          <ComboboxContent portalContainer={portalContainerRef}>
            <ComboboxEmpty>Не найдено</ComboboxEmpty>
            <ComboboxList>
              {(c) => (
                <ComboboxItem key={c.id} value={c}>
                  {c.code_api} — {c.description}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>

        <Combobox
          items={economicCodeQuery.data ?? []}
          value={economicClass}
          onValueChange={(v) => patch({ economicClassId: v?.id ?? null })}
          itemToStringLabel={(c) => (c ? `${c.code_api} ${c.description}` : "")}
          itemToStringValue={(c) => (c ? String(c.id) : "")}>
          <ComboboxInput
            placeholder="Статья ЭКР: все..."
            showClear
            className="w-[40rem] bg-white"
          />
          <ComboboxContent portalContainer={portalContainerRef}>
            <ComboboxEmpty>Не найдено</ComboboxEmpty>
            <ComboboxList>
              {(c) => (
                <ComboboxItem key={c.id} value={c}>
                  {c.code_api} — {c.description}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Combobox
          items={departments}
          value={department}
          onValueChange={(v) => patch({ departmentId: v?.id ?? null })}
          itemToStringLabel={(d) => d?.short_name ?? ""}
          itemToStringValue={(d) => (d ? String(d.id) : "")}>
          <ComboboxInput
            placeholder="Подразделение: все..."
            showClear
            className="w-56 bg-white"
          />
          <ComboboxContent portalContainer={portalContainerRef}>
            <ComboboxEmpty>Подразделение не найдено</ComboboxEmpty>
            <ComboboxList>
              {(d) => (
                <ComboboxItem key={d.id} value={d}>
                  {d.short_name}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>

        <Combobox
          items={internalCodeLeaves}
          value={internalEconomicClass}
          onValueChange={(v) =>
            patch({ internalEconomicClassId: v?.id ?? null })
          }
          itemToStringLabel={(c) => (c ? `${c.code} ${c.name}` : "")}
          itemToStringValue={(c) => (c ? String(c.id) : "")}>
          <ComboboxInput
            placeholder="Внутренний код ЭКР: все..."
            showClear
            className="w-[60rem] bg-white"
          />
          <ComboboxContent portalContainer={portalContainerRef}>
            <ComboboxEmpty>Не найдено</ComboboxEmpty>
            <ComboboxList>
              {(c) => (
                <ComboboxItem key={c.id} value={c}>
                  {c.code} — {c.name}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>

        <Select
          value={value.status}
          onValueChange={(v) => patch({ status: v as StatusFilterValue })}>
          <SelectTrigger className="w-44 bg-white">
            <SelectValue placeholder="Статус..." />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
