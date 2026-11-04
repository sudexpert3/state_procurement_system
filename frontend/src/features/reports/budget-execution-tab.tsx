import type { Department } from "@/shared/api/schema";

import { useMemo, useRef, useState } from "react";

import { useBudgetExecutionReportQuery } from "@/services/reports";
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
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatByn } from "@/shared/lib/helpers/format-money";

const flattenDepartments = (nodes: Department[]): Department[] =>
  nodes.flatMap((node) => [node, ...flattenDepartments(node.sub_departments)]);

export const BudgetExecutionTab = () => {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const [year, setYear] = useState<number | undefined>(
    new Date().getFullYear(),
  );
  const [department, setDepartment] = useState<Department | null>(null);
  const [quarter, setQuarter] = useState<"Q1" | "Q2" | "Q3" | "Q4" | "all">(
    "all",
  );

  const departmentsQuery = rqClient.useQuery("get", "/api/departments/", {
    params: { query: { is_active: true } },
  });
  const departments = useMemo(
    // TODO: убрать приведение после исправления sub_departments в OpenAPI.
    () =>
      flattenDepartments(
        (departmentsQuery.data ?? []) as unknown as Department[],
      ),
    [departmentsQuery.data],
  );

  const { data, isLoading, isError } = useBudgetExecutionReportQuery({
    year,
    department: department?.id,
    quarter: quarter === "all" ? undefined : quarter,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4" ref={portalContainerRef}>
        <Input
          type="number"
          value={year ?? ""}
          onChange={(e) =>
            setYear(e.target.value ? Number(e.target.value) : undefined)
          }
          placeholder="Год"
          className="w-32"
        />

        <Combobox
          items={departments}
          value={department}
          onValueChange={setDepartment}
          itemToStringLabel={(d) => d?.short_name ?? ""}
          itemToStringValue={(d) => (d ? String(d.id) : "")}>
          <ComboboxInput
            placeholder="Все подразделения"
            disabled={departmentsQuery.isLoading}
            showClear
            className="w-64"
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

        <Select
          value={quarter}
          onValueChange={(v) => setQuarter(v as typeof quarter)}>
          <SelectTrigger className="w-40 bg-white">
            <SelectValue placeholder="Квартал" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              <SelectItem value="all">Год целиком</SelectItem>
              <SelectItem value="Q1">I квартал</SelectItem>
              <SelectItem value="Q2">II квартал</SelectItem>
              <SelectItem value="Q3">III квартал</SelectItem>
              <SelectItem value="Q4">IV квартал</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <Skeleton className="h-48 w-full" />}
      {isError && (
        <p className="text-destructive text-sm">Не удалось загрузить отчёт</p>
      )}

      {data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Держатель лимита</TableHead>
              <TableHead>Статья (внутр. ЭКР)</TableHead>
              <TableHead>Назначено</TableHead>
              <TableHead>Принятые обязательства</TableHead>
              <TableHead>Оплачено</TableHead>
              <TableHead>Остаток</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => (
              <TableRow key={i}>
                <TableCell>{row.department}</TableCell>
                <TableCell>
                  {row.internal_economic_class_code} —{" "}
                  {row.internal_economic_class_name}
                </TableCell>
                <TableCell>{formatByn(row.allocated)}</TableCell>
                <TableCell>{formatByn(row.committed_obligations)}</TableCell>
                <TableCell>{formatByn(row.paid)}</TableCell>
                <TableCell
                  className={
                    row.remainder < 0 ? "text-destructive" : undefined
                  }>
                  {formatByn(row.remainder)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
