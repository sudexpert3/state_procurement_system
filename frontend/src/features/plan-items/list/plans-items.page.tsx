import type { PlanItemShort } from "@/shared/api/schema";

import { useMemo } from "react";

import { keepPreviousData } from "@tanstack/react-query";
import { href, useNavigate, useSearchParams } from "react-router";

import { rqClient } from "@/shared/api/instance";
import { DataTable } from "@/shared/components/data-table/data-table";
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
import { ROUTES } from "@/shared/model/routes";

import { createColumns } from "./columns";
import { TableActions } from "./table-actions";

const PlansItemsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const purchase = Number(searchParams.get("purchase")) || 8;

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
    // При переходе между страницами показываем прошлые данные, пока грузятся новые
    { placeholderData: keepPreviousData },
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
    <Card className="max-w-full gap-2 bg-transparent ring-0">
      <CardHeader>
        <CardTitle>Реестр закупок</CardTitle>
        <CardDescription className="text-[12px]">{`Планы закупок на  год`}</CardDescription>
        <CardAction>
          <Button onClick={handleAddProcurement}>Добавить запись</Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <DataTable
          data={data?.results ?? []}
          columns={columns}
          getRow={getRow}
          isLoading={isLoading}
          globalFilter={search}
          onGlobalFilterChange={setSearch}
          manualFiltering
          cellClassName="p-4 text-center"
          actions={(table) => (
            <div className="py-4">
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
