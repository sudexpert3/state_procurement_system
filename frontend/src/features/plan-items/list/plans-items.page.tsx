import type { ColumnFiltersState, OnChangeFn } from "@tanstack/react-table";
import type { PlanItemShort } from "@/shared/api/schema";

import { useMemo } from "react";

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
import {
  type BuyerFilterValue,
  type DepartmentFilterValue,
  RegistryFilters,
  type StatusCategoryFilterValue,
} from "./registry-filters";
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

  // Фильтры реестра (коды ЭКР + исполнитель/подразделение) раньше жили
  // только в useState — при переходе на карточку позиции и возврате назад
  // (`/plan-items` без query-параметров, как у ссылки в сайдбаре) они
  // полностью слетали (запрос пользователя, см. CurrentStatus.md, п.5 от
  // 2026-11-17). Теперь — как `purchase` выше: URL в приоритете (переживает
  // browser back/forward с сохранённой строкой запроса), а если его нет
  // (переход по ссылке сайдбара без query) — откат на последнее значение из
  // localStorage.
  const [storedFilters, setStoredFilters] = useLocalStorageState<{
    functionalCode?: string;
    economicCode?: string;
    internalEconomicCode?: string;
    buyerFilter: BuyerFilterValue;
    departmentFilter: DepartmentFilterValue;
    statusCategoryFilter: StatusCategoryFilterValue;
  }>("plan-items-list:filters", {
    buyerFilter: "all",
    departmentFilter: "all",
    statusCategoryFilter: "active",
  });

  const functionalCode =
    searchParams.get("functional_code") ?? storedFilters.functionalCode;
  const economicCode =
    searchParams.get("economic_code") ?? storedFilters.economicCode;
  const internalEconomicCode =
    searchParams.get("internal_economic_code") ??
    storedFilters.internalEconomicCode;

  // buyer=<id> и buyer_unset=true — взаимоисключающие параметры одного и того
  // же select'а (см. registry-filters.tsx): "конкретный исполнитель" либо
  // "не определён". Если в URL нет ни одного из них — откат на localStorage.
  const buyerParam = searchParams.get("buyer");
  const buyerUnsetParam = searchParams.get("buyer_unset");
  const buyerFilter: BuyerFilterValue =
    buyerParam != null
      ? Number(buyerParam)
      : buyerUnsetParam != null
        ? "unset"
        : storedFilters.buyerFilter;

  const departmentParam = searchParams.get("department");
  const departmentFilter: DepartmentFilterValue =
    departmentParam != null
      ? Number(departmentParam)
      : storedFilters.departmentFilter;

  // "active" — дефолт и на бэкенде (без параметра в запросе), и здесь, в т.ч.
  // как откат для уже существующих значений в localStorage, сохранённых до
  // появления этого фильтра (где ключа statusCategoryFilter ещё не было).
  const statusCategoryParam = searchParams.get("status_category");
  const statusCategoryFilter: StatusCategoryFilterValue =
    (statusCategoryParam as StatusCategoryFilterValue | null) ??
    storedFilters.statusCategoryFilter ??
    "active";

  // Колоночные фильтры (функц./эконом./внутренний ЭКР код) передаются в
  // DataTable как controlled columnFilters — их значения нужны и снаружи,
  // чтобы передать на бэкенд как query-параметры (RegistryFilters только
  // пишет/читает через table.getColumn(id), см. registry-filters.tsx).
  const columnFilters: ColumnFiltersState = useMemo(() => {
    const filters: ColumnFiltersState = [];
    if (functionalCode) {
      filters.push({ id: "functional_code", value: functionalCode });
    }
    if (economicCode) {
      filters.push({ id: "economic_code", value: economicCode });
    }
    if (internalEconomicCode) {
      filters.push({
        id: "internal_economic_code",
        value: internalEconomicCode,
      });
    }
    return filters;
  }, [functionalCode, economicCode, internalEconomicCode]);

  const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (
    updater,
  ) => {
    const next =
      typeof updater === "function" ? updater(columnFilters) : updater;
    const nextFunctional = next.find((f) => f.id === "functional_code")
      ?.value as string | undefined;
    const nextEconomic = next.find((f) => f.id === "economic_code")?.value as
      | string
      | undefined;
    const nextInternal = next.find((f) => f.id === "internal_economic_code")
      ?.value as string | undefined;

    setStoredFilters((prev) => ({
      ...prev,
      functionalCode: nextFunctional,
      economicCode: nextEconomic,
      internalEconomicCode: nextInternal,
    }));
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      const entries: [string, string | undefined][] = [
        ["functional_code", nextFunctional],
        ["economic_code", nextEconomic],
        ["internal_economic_code", nextInternal],
      ];
      entries.forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      params.set("offset", "0");
      return params;
    });
  };

  const handleBuyerFilterChange = (value: BuyerFilterValue) => {
    setStoredFilters((prev) => ({ ...prev, buyerFilter: value }));
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete("buyer");
      params.delete("buyer_unset");
      if (value === "unset") {
        params.set("buyer_unset", "true");
      } else if (value !== "all") {
        params.set("buyer", String(value));
      }
      params.set("offset", "0");
      return params;
    });
  };

  const handleDepartmentFilterChange = (value: DepartmentFilterValue) => {
    setStoredFilters((prev) => ({ ...prev, departmentFilter: value }));
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (value === "all") {
        params.delete("department");
      } else {
        params.set("department", String(value));
      }
      params.set("offset", "0");
      return params;
    });
  };

  const handleStatusCategoryFilterChange = (
    value: StatusCategoryFilterValue,
  ) => {
    setStoredFilters((prev) => ({ ...prev, statusCategoryFilter: value }));
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (value === "active") {
        params.delete("status_category");
      } else {
        params.set("status_category", value);
      }
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
    setStoredFilters((prev) => ({
      ...prev,
      functionalCode: undefined,
      economicCode: undefined,
      internalEconomicCode: undefined,
    }));
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete("functional_code");
      params.delete("economic_code");
      params.delete("internal_economic_code");
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
          buyer_unset: buyerFilter === "unset" || undefined,
          buyer: typeof buyerFilter === "number" ? buyerFilter : undefined,
          department: departmentFilter !== "all" ? departmentFilter : undefined,
          status_category:
            statusCategoryFilter !== "active" ? statusCategoryFilter : undefined,
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
          buyer_unset: buyerFilter === "unset" || undefined,
          buyer: typeof buyerFilter === "number" ? buyerFilter : undefined,
          department: departmentFilter !== "all" ? departmentFilter : undefined,
          status_category:
            statusCategoryFilter !== "active" ? statusCategoryFilter : undefined,
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
              <RegistryFilters
                table={table}
                buyerFilter={buyerFilter}
                onBuyerFilterChange={handleBuyerFilterChange}
                departmentFilter={departmentFilter}
                onDepartmentFilterChange={handleDepartmentFilterChange}
                statusCategoryFilter={statusCategoryFilter}
                onStatusCategoryFilterChange={handleStatusCategoryFilterChange}
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
