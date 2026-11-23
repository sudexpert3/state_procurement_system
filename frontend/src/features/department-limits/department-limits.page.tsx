import type { DepartmentArticleLimit } from "@/shared/api/schema";

import { useCallback, useMemo, useState } from "react";

import { PlusIcon } from "lucide-react";
import { useSearchParams } from "react-router";

import { rqClient } from "@/shared/api/instance";
import { DataTable } from "@/shared/components/data-table/data-table";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { useServerPagination } from "@/shared/components/data-table/hooks/use-server-pagination";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { useLocalStorageState } from "@/shared/lib/react/use-local-storage-state";

import { useDepartmentLimitDelete } from "./hooks/use-department-limit-delete";
import {
  useDepartmentLimits,
  useInvalidateDepartmentLimits,
} from "./hooks/use-department-limits";
import { useOverspendSummary } from "./hooks/use-overspend-summary";
import { createColumns } from "./columns";
import { DepartmentLimitForm } from "./department-limit-form";
import {
  DepartmentLimitsFilters,
  type DepartmentLimitsFiltersValue,
  type StatusFilterValue,
} from "./department-limits-filters";
import { DepartmentLimitsMoneySummary } from "./department-limits-money-summary";
import { OverspendBanner } from "./overspend-banner";

// Сумма под таблицей считается по ПОЛНОМУ списку, подходящему под текущие
// фильтры, не по текущей странице — тот же приём, что на «Реестре закупок»
// (см. plans-items.page.tsx/FULL_YEAR_LIMIT).
const FULL_LIST_LIMIT = 10000;

const DepartmentLimitsPage = () => {
  const { limit, offset, pagination, onPaginationChange } =
    useServerPagination();

  // Фильтры переживают перезагрузку страницы и переход на другую страницу и
  // обратно — URL в приоритете (переживает browser back/forward), а если его
  // нет (переход по ссылке сайдбара без query) — откат на последнее значение
  // из localStorage. Тот же приём, что на «Реестре закупок»
  // (plans-items.page.tsx/storedFilters).
  const [searchParams, setSearchParams] = useSearchParams();
  const [storedFilters, setStoredFilters] =
    useLocalStorageState<DepartmentLimitsFiltersValue>(
      "department-limits:filters",
      {
        year: new Date().getFullYear(),
        functionalClassId: null,
        economicClassId: null,
        departmentId: null,
        internalEconomicClassId: null,
        status: "ACTIVE",
      },
    );

  const yearParam = searchParams.get("year");
  const functionalClassParam = searchParams.get("functional_class");
  const economicClassParam = searchParams.get("economic_class");
  const departmentParam = searchParams.get("department");
  const internalEconomicClassParam = searchParams.get(
    "internal_economic_class",
  );
  const statusParam = searchParams.get("status");

  const filters: DepartmentLimitsFiltersValue = {
    year: yearParam != null ? Number(yearParam) : storedFilters.year,
    functionalClassId:
      functionalClassParam != null
        ? Number(functionalClassParam)
        : storedFilters.functionalClassId,
    economicClassId:
      economicClassParam != null
        ? Number(economicClassParam)
        : storedFilters.economicClassId,
    departmentId:
      departmentParam != null
        ? Number(departmentParam)
        : storedFilters.departmentId,
    internalEconomicClassId:
      internalEconomicClassParam != null
        ? Number(internalEconomicClassParam)
        : storedFilters.internalEconomicClassId,
    status: (statusParam as StatusFilterValue | null) ?? storedFilters.status,
  };

  const handleFiltersChange = (next: DepartmentLimitsFiltersValue) => {
    setStoredFilters(next);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      const setOrDelete = (key: string, id: number | null) => {
        if (id != null) params.set(key, String(id));
        else params.delete(key);
      };

      params.set("year", String(next.year));
      setOrDelete("functional_class", next.functionalClassId);
      setOrDelete("economic_class", next.economicClassId);
      setOrDelete("department", next.departmentId);
      setOrDelete("internal_economic_class", next.internalEconomicClassId);
      params.set("status", next.status);
      // Фильтр мог сильно сократить список — без сброса легко оказаться на
      // несуществующей странице (пустой список вместо первых результатов).
      params.set("offset", "0");
      return params;
    });
  };

  const apiFilters = {
    year: filters.year,
    ...(filters.status !== "all" && { status: filters.status }),
    functional_class: filters.functionalClassId ?? undefined,
    economic_class: filters.economicClassId ?? undefined,
    department: filters.departmentId ?? undefined,
    internal_economic_class: filters.internalEconomicClassId ?? undefined,
  };

  const { data, isLoading } = useDepartmentLimits(apiFilters, {
    limit,
    offset,
  });
  // Та же выборка, но без среза по страницам — только для суммы снизу
  // (DataTablePagination/DepartmentLimitsMoneySummary). Специально без
  // placeholderData (в отличие от основного списка выше): пока считается
  // новая сумма под новые фильтры, старая не должна молча выдаваться за
  // актуальную — DepartmentLimitsMoneySummary покажет "считается...".
  const { data: fullFilteredData, isLoading: isSumLoading } = rqClient.useQuery(
    "get",
    "/api/department_article_limits/",
    { params: { query: { ...apiFilters, limit: FULL_LIST_LIMIT } } },
  );
  const invalidate = useInvalidateDepartmentLimits();

  const overspendQuery = useOverspendSummary(filters.year);

  const { handleDelete, deletingId } = useDepartmentLimitDelete(invalidate);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DepartmentArticleLimit | null>(
    null,
  );

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleEdit = useCallback((item: DepartmentArticleLimit) => {
    setEditingItem(item);
    setDrawerOpen(true);
  }, []);

  const columns = useMemo(
    () => createColumns(handleEdit, handleDelete, deletingId),
    [handleEdit, handleDelete, deletingId],
  );

  return (
    <Card className="max-w-full flex-1 gap-2 bg-transparent ring-0">
      <CardHeader>
        <CardTitle>Распределение лимитов</CardTitle>
        <CardDescription>
          Доведённые Казначейством лимиты по подстатьям и держателям — действуют
          сразу после активации, без согласования
        </CardDescription>
        <CardAction>
          <Button onClick={handleAdd}>
            <PlusIcon size={16} />
            Добавить
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <DepartmentLimitsFilters
          value={filters}
          onChange={handleFiltersChange}
        />

        {overspendQuery.data?.length ? (
          <OverspendBanner lines={overspendQuery.data} />
        ) : null}

        <DataTable
          data={data?.results ?? []}
          columns={columns}
          isLoading={isLoading}
          fillAvailableHeight
          pagination={{
            type: "default",
            manual: {
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
              rowCount: data?.count ?? 0,
              onChange: onPaginationChange,
            },
            render: (table) => (
              <DataTablePagination
                table={table}
                summary={
                  <DepartmentLimitsMoneySummary
                    items={fullFilteredData?.results}
                    isLoading={isSumLoading}
                  />
                }
              />
            ),
          }}
        />
      </CardContent>

      <DepartmentLimitForm
        open={drawerOpen}
        item={editingItem}
        defaultYear={filters.year}
        onClose={() => setDrawerOpen(false)}
        onSuccess={invalidate}
      />
    </Card>
  );
};

export const Component = DepartmentLimitsPage;
