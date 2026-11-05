import type { PlanItemShort } from "@/shared/api/schema";

import { useMemo } from "react";

import { keepPreviousData } from "@tanstack/react-query";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { href, useNavigate, useSearchParams } from "react-router";

import { useSyncPurchaseItemsAction } from "@/services/goszakupki";
import { rqClient } from "@/shared/api/instance";
import { DataTable } from "@/shared/components/data-table/data-table";
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
import { ROUTES } from "@/shared/model/routes";

import { createColumns } from "./columns";
import { TableActions } from "./table-actions";
import { YearToggle } from "./year-toggle";

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

  const purchaseParam = searchParams.get("purchase");
  // Пришли с конкретного плана ("Годовые планы") — берём его id из URL.
  // Пришли откуда угодно ещё (прямой переход, другой раздел) — берём самый
  // актуальный год (первый в списке, он отсортирован по убыванию).
  const purchase = purchaseParam ? Number(purchaseParam) : years[0]?.purchaseId;

  const purchaseRecord = purchases?.find((p) => p.id === purchase);
  const { sync: syncItems, isPending: isSyncingItems } =
    useSyncPurchaseItemsAction();

  const handleSelectYear = (purchaseId: number) => {
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
          // TODO: поиск на бэке реализован плохо — переделать, когда доработают
          // эндпоинт (какие поля ищутся, частичное совпадение, регистр)
          search: debouncedSearch || undefined,
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

  // const year = data?.results[0]?.economic_details[0]?.year ?? "#";

  const columns = useMemo(() => {
    return createColumns();
  }, []);

  // const { data } = rqClient.useQuery("get", "/gpz/");
  // console.log(data);
  // const getAuth = async () => {
  //   const res = await fetchClient.GET("/gpz", {});
  //   console.log("result", res);
  // };
  // useEffect(() => {
  //   getAuth();
  // }, []);

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
          manualFiltering
          fillAvailableHeight
          cellClassName="p-4 text-center"
          actions={(table) => (
            <div className="py-2">
              <TableActions table={table} />
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
          }}
        />
      </CardContent>
    </Card>
  );
};

export const Component = PlansItemsPage;
