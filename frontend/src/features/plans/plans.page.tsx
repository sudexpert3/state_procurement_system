import type { Purchase } from "@/shared/api/schema";

import { useMemo } from "react";

import { generatePath, useNavigate } from "react-router";

import { rqClient } from "@/shared/api/instance";
import { DataTable } from "@/shared/components/data-table/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { ROUTES } from "@/shared/model/routes";

import { createColumns } from "./columns";

const PlansPage = () => {
  const navigate = useNavigate();

  const { data, isPending } = rqClient.useQuery("get", "/api/purchases/", {});

  const columns = useMemo(() => createColumns(), []);

  const handleRowClick = (row: Purchase) => {
    navigate(generatePath(ROUTES.PROCUREMENT, { id: String(row.id) }));
  };

  return (
    <Card className="max-w-full gap-2 bg-transparent ring-0">
      <CardHeader>
        <CardTitle>Годовые планы</CardTitle>
        <CardDescription className="text-[12px]">
          Реестр годовых планов государственных закупок
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          data={data ?? []}
          columns={columns}
          getRow={handleRowClick}
          isLoading={isPending}
          cellClassName="text-center"
        />
      </CardContent>
    </Card>
  );
};

export const Component = PlansPage;
