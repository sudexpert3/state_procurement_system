import type { PlanItemShort } from "@/shared/api/schema";

import { useMemo } from "react";

import { href, useNavigate } from "react-router";

import { rqClient } from "@/shared/api/instance";
import { DataTable } from "@/shared/components/data-table/data-table";
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

const ProcurementsPage = () => {
  const navigate = useNavigate();
  const getRow = (row: PlanItemShort) => {
    navigate(href(ROUTES.PROCUREMENT, { id: row?.id }), { state: row });
  };
  const { data } = rqClient.useQuery("get", "/api/plan_items/", {});

  // const year = new Date().getFullYear();

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
    navigate(ROUTES.PROCUREMENT_ADD);
  };

  return (
    <Card className="max-w-full gap-2 bg-transparent ring-0">
      <CardHeader>
        <CardTitle>Реестр закупок</CardTitle>
        <CardDescription className="text-[12px]">{`Планы закупок на текущий год`}</CardDescription>
        <CardAction>
          <Button onClick={handleAddProcurement}>Добавить запись</Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <DataTable
          data={data?.results ?? []}
          columns={columns}
          getRow={getRow}
          cellClassName="p-4 text-center"
          actions={(table) => (
            <div className="py-4">
              <TableActions table={table} />
            </div>
          )}
          pagination={{ type: "default" }}
        />
      </CardContent>
    </Card>
  );
};

export const Component = ProcurementsPage;
