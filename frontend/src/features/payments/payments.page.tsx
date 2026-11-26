import type { DateRange } from "react-day-picker";
import type { TreasuryPayment } from "@/shared/api/schema";

import { useCallback, useMemo, useState } from "react";

import { keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import { PlusIcon } from "lucide-react";

import { PaymentForm } from "@/services/payments";
import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
import { DataTable } from "@/shared/components/data-table/data-table";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { useServerPagination } from "@/shared/components/data-table/hooks/use-server-pagination";
import { useServerSearch } from "@/shared/components/data-table/hooks/use-server-search";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

import { usePaymentsDelete } from "./hooks/use-payments-delete";
import { createColumns } from "./columns";
import { PaymentsMoneySummary } from "./payments-money-summary";
import {
  type ClassFilterValue,
  PaymentsToolbar,
  type QuarterFilterValue,
} from "./payments-toolbar";

// Сумма под таблицей считается по ПОЛНОМУ списку, подходящему под текущие
// фильтры, не по текущей странице — тот же приём, что и на "Реестре закупок"
// и "Реестре договоров" (см. contracts.page.tsx/FULL_LIST_LIMIT).
const FULL_LIST_LIMIT = 10000;

const PaymentsPage = () => {
  const { limit, offset, pagination, onPaginationChange } =
    useServerPagination();
  const { search, debouncedSearch, setSearch } = useServerSearch();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [quarterFilter, setQuarterFilter] = useState<QuarterFilterValue>("all");
  const [yearFilter, setYearFilter] = useState<number | "all">("all");
  const [kindFilter, setKindFilter] = useState<number | "all">("all");
  const [economicClassFilter, setEconomicClassFilter] =
    useState<ClassFilterValue>("all");
  const [functionalClassFilter, setFunctionalClassFilter] =
    useState<ClassFilterValue>("all");
  const [internalEconomicClassFilter, setInternalEconomicClassFilter] =
    useState<ClassFilterValue>("all");
  const [departmentsFilter, setDepartmentsFilter] = useState<number[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TreasuryPayment | null>(null);
  // Клик по строке открывает ту же карточку в режиме просмотра (readOnly) —
  // кнопка "Сохранить" скрыта, поля недоступны для правки; карандаш в
  // колонке "actions" сразу открывает её в режиме редактирования.
  const [viewOnly, setViewOnly] = useState(false);

  const kindOfPaymentQuery = rqClient.useQuery("get", "/api/kind_of_payment/");

  // Границы периода включительно (бэкенд добавил 2026-11-18, см.
  // CurrentStatus.md) — формат YYYY-MM-DD, как ожидает DRF DateFilter.
  const dateRangeParams = {
    payment_date_after: dateRange?.from
      ? format(dateRange.from, "yyyy-MM-dd")
      : undefined,
    payment_date_before: dateRange?.to
      ? format(dateRange.to, "yyyy-MM-dd")
      : undefined,
  };

  const { data, isLoading } = rqClient.useQuery(
    "get",
    "/api/payments/",
    {
      params: {
        query: {
          limit,
          offset,
          search: debouncedSearch || undefined,
          quarter: quarterFilter !== "all" ? quarterFilter : undefined,
          payment_year: yearFilter !== "all" ? yearFilter : undefined,
          kind: kindFilter !== "all" ? kindFilter : undefined,
          economic_class:
            economicClassFilter !== "all" ? economicClassFilter : undefined,
          functional_class:
            functionalClassFilter !== "all" ? functionalClassFilter : undefined,
          internal_economic_class:
            internalEconomicClassFilter !== "all"
              ? internalEconomicClassFilter
              : undefined,
          departments: departmentsFilter.length ? departmentsFilter : undefined,
          ...dateRangeParams,
        },
      },
    },
    { placeholderData: keepPreviousData },
  );

  // Тот же набор условий, но без пагинации — только для суммы снизу.
  // Специально без placeholderData: пока считается новая сумма, старая не
  // должна молча выдаваться за актуальную — PaymentsMoneySummary покажет
  // "считается...".
  const { data: fullFilteredData, isLoading: isSumLoading } = rqClient.useQuery(
    "get",
    "/api/payments/",
    {
      params: {
        query: {
          limit: FULL_LIST_LIMIT,
          search: debouncedSearch || undefined,
          quarter: quarterFilter !== "all" ? quarterFilter : undefined,
          payment_year: yearFilter !== "all" ? yearFilter : undefined,
          kind: kindFilter !== "all" ? kindFilter : undefined,
          economic_class:
            economicClassFilter !== "all" ? economicClassFilter : undefined,
          functional_class:
            functionalClassFilter !== "all" ? functionalClassFilter : undefined,
          internal_economic_class:
            internalEconomicClassFilter !== "all"
              ? internalEconomicClassFilter
              : undefined,
          departments: departmentsFilter.length ? departmentsFilter : undefined,
          ...dateRangeParams,
        },
      },
    },
  );

  const invalidate = useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: ["get", "/api/payments/"] }),
    [],
  );

  const { handleDelete, deletingId } = usePaymentsDelete(invalidate);

  const handleAdd = () => {
    setEditingItem(null);
    setViewOnly(false);
    setDrawerOpen(true);
  };

  const handleEdit = useCallback((item: TreasuryPayment) => {
    setEditingItem(item);
    setViewOnly(false);
    setDrawerOpen(true);
  }, []);

  const handleView = useCallback((item: TreasuryPayment) => {
    setEditingItem(item);
    setViewOnly(true);
    setDrawerOpen(true);
  }, []);

  const columns = useMemo(
    () => createColumns(handleEdit, handleDelete, deletingId),
    [handleEdit, handleDelete, deletingId],
  );

  return (
    <Card className="max-w-full flex-1 gap-2 bg-transparent ring-0">
      <CardHeader>
        <CardTitle>Платежи</CardTitle>
        <CardDescription>
          Платёжные поручения: по договорам и свободные платежи по статьям
        </CardDescription>
        <CardAction>
          <Button onClick={handleAdd}>
            <PlusIcon size={16} />
            Новый платёж
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <DataTable
          data={data?.results ?? []}
          columns={columns}
          isLoading={isLoading}
          cellClassName=""
          getRow={handleView}
          fillAvailableHeight
          actions={() => (
            <div className="py-4">
              <PaymentsToolbar
                search={search}
                onSearchChange={setSearch}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                quarterFilter={quarterFilter}
                onQuarterFilterChange={setQuarterFilter}
                yearFilter={yearFilter}
                onYearFilterChange={setYearFilter}
                kindFilter={kindFilter}
                onKindFilterChange={setKindFilter}
                kindOptions={kindOfPaymentQuery.data ?? []}
                economicClassFilter={economicClassFilter}
                onEconomicClassFilterChange={setEconomicClassFilter}
                functionalClassFilter={functionalClassFilter}
                onFunctionalClassFilterChange={setFunctionalClassFilter}
                internalEconomicClassFilter={internalEconomicClassFilter}
                onInternalEconomicClassFilterChange={
                  setInternalEconomicClassFilter
                }
                departmentsFilter={departmentsFilter}
                onDepartmentsFilterChange={setDepartmentsFilter}
              />
            </div>
          )}
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
                  <PaymentsMoneySummary
                    items={fullFilteredData?.results}
                    isLoading={isSumLoading}
                  />
                }
              />
            ),
          }}
        />
      </CardContent>

      <PaymentForm
        open={drawerOpen}
        item={editingItem}
        readOnly={viewOnly}
        onClose={() => setDrawerOpen(false)}
        onSuccess={invalidate}
      />
    </Card>
  );
};

export const Component = PaymentsPage;
