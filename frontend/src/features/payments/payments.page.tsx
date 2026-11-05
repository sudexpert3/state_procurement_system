import type { TreasuryPayment } from "@/shared/api/schema";

import { useCallback, useMemo, useState } from "react";

import { keepPreviousData } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
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

import { usePaymentsDelete } from "./hooks/use-payments-delete";
import { createColumns } from "./columns";
import { PaymentForm } from "./payment-form";
import { PaymentsToolbar, type QuarterFilterValue } from "./payments-toolbar";

const PaymentsPage = () => {
  const { limit, offset, pagination, onPaginationChange } =
    useServerPagination();
  const [quarterFilter, setQuarterFilter] = useState<QuarterFilterValue>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TreasuryPayment | null>(null);

  const { data, isLoading } = rqClient.useQuery(
    "get",
    "/api/payments/",
    {
      params: {
        query: {
          limit,
          offset,
          quarter: quarterFilter !== "all" ? quarterFilter : undefined,
        },
      },
    },
    { placeholderData: keepPreviousData },
  );

  const invalidate = useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: ["get", "/api/payments/"] }),
    [],
  );

  const { handleDelete, deletingId } = usePaymentsDelete(invalidate);

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleEdit = useCallback((item: TreasuryPayment) => {
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
          fillAvailableHeight
          actions={() => (
            <div className="py-4">
              <PaymentsToolbar
                quarterFilter={quarterFilter}
                onQuarterFilterChange={setQuarterFilter}
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

      <PaymentForm
        open={drawerOpen}
        item={editingItem}
        onClose={() => setDrawerOpen(false)}
        onSuccess={invalidate}
      />
    </Card>
  );
};

export const Component = PaymentsPage;
