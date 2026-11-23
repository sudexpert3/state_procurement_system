import type { KindOfPayment } from "@/shared/api/schema";

import { useCallback, useMemo, useState } from "react";

import { PlusIcon } from "lucide-react";

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

import { useKindOfPayment } from "./hooks/use-kind-of-payment";
import { useKindOfPaymentDelete } from "./hooks/use-kind-of-payment-delete";
import { createColumns } from "./columns";
import { KindOfPaymentForm } from "./kind-of-payment-form";
import { KindOfPaymentToolbar } from "./kind-of-payment-toolbar";

const KindOfPaymentPage = () => {
  const {
    search,
    setSearch,
    refundFilter,
    setRefundFilter,
    data,
    isLoading,
    invalidate,
  } = useKindOfPayment();

  const { handleDelete, deletingId } = useKindOfPaymentDelete(invalidate);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KindOfPayment | null>(null);

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleEdit = useCallback((item: KindOfPayment) => {
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
        <CardTitle>Виды платежей</CardTitle>
        <CardDescription>
          Справочник видов платежей (обычные / возвраты)
        </CardDescription>
        <CardAction>
          <Button onClick={handleAdd}>
            <PlusIcon size={16} />
            Добавить
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <DataTable
          data={data}
          columns={columns}
          isLoading={isLoading}
          cellClassName=""
          fillAvailableHeight
          actions={() => (
            <div className="py-4">
              <KindOfPaymentToolbar
                search={search}
                onSearchChange={setSearch}
                refundFilter={refundFilter}
                onRefundFilterChange={setRefundFilter}
              />
            </div>
          )}
        />
      </CardContent>

      <KindOfPaymentForm
        open={drawerOpen}
        item={editingItem}
        onClose={() => setDrawerOpen(false)}
        onSuccess={invalidate}
      />
    </Card>
  );
};

export const Component = KindOfPaymentPage;
