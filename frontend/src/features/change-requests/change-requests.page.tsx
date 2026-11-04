import type {
  ChangeRequest,
  ChangeRequestKind,
  ChangeRequestStatus,
} from "@/services/change-requests";

import { useMemo, useState } from "react";

import { useChangeRequestsQuery } from "@/services/change-requests";
import { DataTable } from "@/shared/components/data-table/data-table";
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

import { ChangeRequestDetail } from "./detail/change-request-detail";
import { ChangeRequestsToolbar } from "./change-requests-toolbar";
import { createColumns } from "./columns";
import { RedistributionForm } from "./redistribution-form";

const ChangeRequestsPage = () => {
  const { limit, offset, pagination, onPaginationChange } =
    useServerPagination();
  const [statusFilter, setStatusFilter] = useState<ChangeRequestStatus | "all">(
    "all",
  );
  const [kindFilter, setKindFilter] = useState<ChangeRequestKind | "all">(
    "all",
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [redistributionOpen, setRedistributionOpen] = useState(false);

  const { data, isLoading } = useChangeRequestsQuery(
    Object.assign(
      { limit, offset },
      statusFilter !== "all" && { status: statusFilter },
      kindFilter !== "all" && { kind: kindFilter },
    ),
  );

  const selectedItem = useMemo(
    () => data?.results.find((item) => item.id === selectedId) ?? null,
    [data, selectedId],
  );

  const columns = useMemo(
    () => createColumns((item: ChangeRequest) => setSelectedId(item.id)),
    [],
  );

  return (
    <Card className="max-w-full gap-2 bg-transparent ring-0">
      <CardHeader>
        <CardTitle>Заявки на изменение</CardTitle>
        <CardDescription>
          Движок одобрения изменений: позиции плана, лимиты, калибровка по
          подразделениям
        </CardDescription>
        <CardAction>
          <Button onClick={() => setRedistributionOpen(true)}>
            Перераспределить лимит
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <DataTable
          data={data?.results ?? []}
          columns={columns}
          isLoading={isLoading}
          cellClassName=""
          actions={() => (
            <div className="py-4">
              <ChangeRequestsToolbar
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                kindFilter={kindFilter}
                onKindFilterChange={setKindFilter}
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
          }}
        />
      </CardContent>

      <ChangeRequestDetail
        item={selectedItem}
        onClose={() => setSelectedId(null)}
      />
      <RedistributionForm
        open={redistributionOpen}
        onClose={() => setRedistributionOpen(false)}
        onSuccess={setSelectedId}
      />
    </Card>
  );
};

export const Component = ChangeRequestsPage;
