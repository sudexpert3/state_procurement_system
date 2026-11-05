import type { Contract } from "@/shared/api/schema";

import { useMemo, useState } from "react";

import { keepPreviousData } from "@tanstack/react-query";

import { rqClient } from "@/shared/api/instance";
import { DataTable } from "@/shared/components/data-table/data-table";
import { useServerPagination } from "@/shared/components/data-table/hooks/use-server-pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

import { createColumns } from "./columns";
import { ContractDetail } from "./contract-detail";

const ContractsPage = () => {
  const { limit, offset, pagination, onPaginationChange } =
    useServerPagination();
  const [selected, setSelected] = useState<Contract | null>(null);

  const { data, isLoading } = rqClient.useQuery(
    "get",
    "/api/contracts/",
    { params: { query: { limit, offset } } },
    { placeholderData: keepPreviousData },
  );

  const columns = useMemo(() => createColumns(setSelected), []);

  return (
    <Card className="max-w-full flex-1 gap-2 bg-transparent ring-0">
      <CardHeader>
        <CardTitle>Реестр договоров</CardTitle>
        <CardDescription>
          Казначейский контроль исполнения договоров ГКСЭ
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <DataTable
          data={data?.results ?? []}
          columns={columns}
          isLoading={isLoading}
          cellClassName=""
          getRow={setSelected}
          fillAvailableHeight
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

      <ContractDetail item={selected} onClose={() => setSelected(null)} />
    </Card>
  );
};

export const Component = ContractsPage;
