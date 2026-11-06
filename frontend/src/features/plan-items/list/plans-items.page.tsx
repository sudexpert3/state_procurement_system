import type { ColumnFiltersState, OnChangeFn } from "@tanstack/react-table";
import type { PlanItemShort } from "@/shared/api/schema";

import { useMemo, useState } from "react";

import { keepPreviousData } from "@tanstack/react-query";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { href, useNavigate, useSearchParams } from "react-router";

import { useSyncPurchaseItemsAction } from "@/services/goszakupki";
import { rqClient } from "@/shared/api/instance";
import { DataTable } from "@/shared/components/data-table/data-table";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { useServerPagination } from "@/shared/components/data-table/hooks/use-server-pagination";
import { useServerSearch } from "@/shared/components/data-table/hooks/use-server-search";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { useLocalStorageState } from "@/shared/lib/react/use-local-storage-state";
import { ROUTES } from "@/shared/model/routes";

import { createColumns } from "./columns";
import { RegistryFilters } from "./registry-filters";
import { RegistryMoneySummary } from "./registry-money-summary";
import { TableActions } from "./table-actions";
import { YearToggle } from "./year-toggle";

// Сумма по "Из них: год — ..." считается отдельным запросом без среза по
// странице (большой limit) — бэкенд быстро отвечает на маленькие
// постраничные запросы (~60-80мс), но на большие выборки стабильно уходит
// ~2 сек независимо от повторных вызовов (см. CurrentStatus.md), поэтому
// сумма сознательно не блокирует отрисовку самого списка — обновляется с
// задержкой, список — сразу.
const FULL_YEAR_LIMIT = 10000;

const PlansItemsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Список годовых планов — источник и для переключателя годов, и для
  // внешнего purchase_id (нужен эндпоинту синхронизации goszakupki.by,
  // который принимает ID портала, а не Purchases.id — наш первичный ключ).
  const { data: purchases } = rqClient.useQuery("get", "/api/purchases/", {});

  const years = useMemo(
    () =>
      (purchases ?? [])
        .filter((p): p is typeof p & { year: number } => p.year != null)
        .sort((a, b) => b.year - a.year)
        .map((p) => ({ year: p.year, purchaseId: p.id })),
    [purchases],
  );

  // Последний выбранный вручную год переживает переход на другую страницу и
  // обратно — без этого при возврате год всегда сбрасывался на самый
  // актуальный (см. ниже), даже если пользователь явно листал к старому.
  const [storedPurchaseId, setStoredPurchaseId] = useLocalStorageState<
    number | null
  >("plan-items-list:purchase", null);

  const purchaseParam = searchParams.get("purchase");
  // Пришли с конкретного плана ("Годовые планы") — берём его id из URL.
  // Иначе — последний выбранный вручную год, а если его ещё не было — самый
  // актуальный (первый в списке, он отсортирован по убыванию).
  const purchase = purchaseParam
    ? Number(purchaseParam)
    : (storedPurchaseId ?? years[0]?.purchaseId);

  const purchaseRecord = purchases?.find((p) => p.id === purchase);
  const { sync: syncItems, isPending: isSyncingItems } =
    useSyncPurchaseItemsAction();

  // Колоночные фильтры (функц./эконом./внутренний ЭКР код) живут здесь, а не
  // внутри DataTable — их значения нужны снаружи, чтобы передать на бэкенд
  // как query-параметры (RegistryFilters только пишет/читает через
  // table.getColumn(id), см. registry-filters.tsx).
  const [columnFilters, setColumnFiltersState] = useState<ColumnFiltersState>(
    [],
  );

  const getColumnFilterValue = (id: string) =>
    columnFilters.find((filter) => filter.id === id)?.value as
      | string
      | undefined;

  const functionalCode = getColumnFilterValue("functional_code");
  const economicCode = getColumnFilterValue("economic_code");
  const internalEconomicCode = getColumnFilterValue("internal_economic_code");

  const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (
    updater,
  ) => {
    setColumnFiltersState((prev) =>
      typeof updater === "function" ? updater(prev) : updater,
    );
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("offset", "0");
      return params;
    });
  };

  const handleSelectYear = (purchaseId: number) => {
    setStoredPurchaseId(purchaseId);
    // Выбранные коды привязаны к конкретному году — в другом году они почти
    // наверняка не встретятся (список значений в комбобоксах при этом не
    // зависит от года, см. registry-filters.tsx), поэтому сбрасываем, чтобы
    // не показывать молча пустой реестр из-за "залипшего" фильтра.
    setColumnFiltersState([]);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("purchase", String(purchaseId));
      params.set("offset", "0");
      return params;
    });
  };

  const { limit, offset, pagination, onPaginationChange } =
    useServerPagination();
  const { search, debouncedSearch, setSearch } = useServerSearch();

  const getRow = (row: PlanItemShort) => {
    navigate(href(ROUTES.PLAN_ITEM, { id: String(row.id) }));
  };

  const { data, isLoading } = rqClient.useQuery(
    "get",
    "/api/plan_items/",
    {
      params: {
        query: {
          limit,
          offset,
          purchase,
          search: debouncedSearch || undefined,
          functional_code: functionalCode,
          economic_code: economicCode,
          internal_economic_code: internalEconomicCode,
        },
      },
    },
    {
      // При переходе между страницами показываем прошлые данные, пока грузятся новые
      placeholderData: keepPreviousData,
      // До того как подгрузится список планов (и, соответственно, актуальный
      // год по умолчанию), запрос не имеет смысла — purchase ещё неизвестен.
      enabled: purchase !== undefined,
    },
  );

  // Тот же набор условий, но без пагинации — только для суммы снизу
  // (DataTablePagination/RegistryMoneySummary). Специально без
  // placeholderData: пока считается новая сумма, старая не должна молча
  // выдаваться за актуальную — RegistryMoneySummary покажет "считается...".
  const { data: fullFilteredData, isLoading: isSumLoading } = rqClient.useQuery(
    "get",
    "/api/plan_items/",
    {
      params: {
        query: {
          limit: FULL_YEAR_LIMIT,
          purchase,
          search: debouncedSearch || undefined,
          functional_code: functionalCode,
          economic_code: economicCode,
          internal_economic_code: internalEconomicCode,
        },
      },
    },
    { enabled: purchase !== undefined },
  );

  const columns = useMemo(() => {
    return createColumns();
  }, []);

  const handleAddProcurement = () => {
    navigate(ROUTES.PLAN_ITEM_ADD);
  };

  return (
    <Card className="max-w-full flex-1 gap-1 bg-transparent pt-2 pb-1 ring-0">
      <CardHeader className="px-2">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>Реестр закупок</CardTitle>
          <YearToggle
            years={years}
            activePurchaseId={purchase ?? null}
            onSelect={handleSelectYear}
          />
        </div>
        <CardAction className="flex gap-2">
          <Button
            variant="outline"
            disabled={!purchaseRecord?.purchase_id || isSyncingItems}
            onClick={() =>
              purchaseRecord?.purchase_id &&
              syncItems(purchaseRecord.purchase_id)
            }>
            {isSyncingItems ? (
              <Loader2Icon size={16} className="animate-spin" />
            ) : (
              <RefreshCwIcon size={16} />
            )}
            Синхронизировать позиции с ЭТП
          </Button>
          <Button onClick={handleAddProcurement}>Добавить позицию плана</Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-2">
        <DataTable
          data={data?.results ?? []}
          columns={columns}
          getRow={getRow}
          isLoading={isLoading}
          globalFilter={search}
          onGlobalFilterChange={setSearch}
          columnFilters={columnFilters}
          onColumnFiltersChange={handleColumnFiltersChange}
          manualFiltering
          fillAvailableHeight
          persistenceKey="plan-items-list"
          cellClassName="p-4 text-center"
          actions={(table) => (
            <div className="flex flex-wrap items-center gap-2 py-2">
              <TableActions table={table} />
              <RegistryFilters table={table} />
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
                  <RegistryMoneySummary
                    items={fullFilteredData?.results}
                    isLoading={isSumLoading}
                  />
                }
              />
            ),
          }}
        />
      </CardContent>
    </Card>
  );
};

export const Component = PlansItemsPage;
