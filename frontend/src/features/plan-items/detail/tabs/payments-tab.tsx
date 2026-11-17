import type { ColumnDef } from "@tanstack/react-table";
import type { TreasuryPayment } from "@/shared/api/schema";

import { useCallback, useMemo, useState } from "react";

import { PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { QuarterlyFinanceTable } from "@/services/contracts";
import { PaymentForm } from "@/services/payments";
import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
import { DataTable } from "@/shared/components/data-table/data-table";
import { DataTableCell } from "@/shared/components/data-table/data-table-cell";
import { DeleteButton } from "@/shared/components/delete-button";
import { SectionCard } from "@/shared/components/section-card";
import { Button } from "@/shared/components/ui/button";
import { CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatDate } from "@/shared/lib/helpers/format-date";
import { formatByn } from "@/shared/lib/helpers/format-money";

import { ContractPickerList, usePlanItemContracts } from "./contract-picker";

const invalidatePayments = () =>
  queryClient.invalidateQueries({ queryKey: ["get", "/api/payments/"] });

const columns = (
  onEdit: (item: TreasuryPayment) => void,
  onDelete: (id: number) => void,
  deletingId: number | null,
): ColumnDef<TreasuryPayment>[] => [
  {
    id: "actions",
    size: 50,
    cell: ({ row }) => (
      <DataTableCell>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(row.original)}>
          <PencilIcon size={16} className="text-muted-foreground" />
        </Button>
        <DeleteButton
          onConfirm={() => onDelete(row.original.id)}
          isPending={deletingId === row.original.id}
        />
      </DataTableCell>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "payment_date",
    header: "Дата",
    cell: ({ getValue }) => formatDate(getValue<string | undefined>()),
  },
  {
    accessorKey: "amount",
    header: "Сумма",
    cell: ({ getValue }) => formatByn(getValue<string>()),
  },
  {
    id: "kind",
    header: "Вид платежа",
    cell: ({ row }) => row.original.kind_detail?.name ?? "—",
  },
  {
    accessorKey: "notice",
    header: "Примечание",
    cell: ({ getValue }) => getValue<string | null>() ?? "—",
  },
];

// Таб «Платежи» на карточке позиции плана — тот же выбор договора, что и в
// ContractsTab (0/1/>1, общий хук/кэш — см. contract-picker). Для выбранного
// договора — его платежи (режим формы с зафиксированным договором) и
// квартальный план/факт (переиспользован из services/contracts).
export const PaymentsTab = ({ planItemId }: { planItemId: number }) => {
  const { contracts, isLoading, selectedContract, setSelectedId } =
    usePlanItemContracts(planItemId);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TreasuryPayment | null>(null);

  const paymentsQuery = rqClient.useQuery(
    "get",
    "/api/payments/",
    { params: { query: { contract: selectedContract?.id, limit: 1000 } } },
    { enabled: selectedContract !== null },
  );

  const deleteMutation = rqClient.useMutation("delete", "/api/payments/{id}/");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };
  const handleEdit = useCallback((item: TreasuryPayment) => {
    setEditingItem(item);
    setDrawerOpen(true);
  }, []);
  const handleDelete = useCallback(
    (id: number) => {
      setDeletingId(id);
      deleteMutation.mutate(
        { params: { path: { id } } },
        {
          onSuccess: () => {
            setDeletingId(null);
            invalidatePayments();
            toast.success("Платёж удалён");
          },
          onError: () => {
            setDeletingId(null);
            toast.error("Не удалось удалить платёж");
          },
        },
      );
    },
    [deleteMutation],
  );

  const paymentColumns = useMemo(
    () => columns(handleEdit, handleDelete, deletingId),
    [handleEdit, handleDelete, deletingId],
  );

  return (
    <SectionCard title="Платежи">
      <CardContent className="space-y-4 px-2">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : contracts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            По этому пункту плана договоров нет — платить не по чему.
          </p>
        ) : (
          <>
            {contracts.length > 1 && (
              <ContractPickerList
                contracts={contracts}
                onSelect={(c) => setSelectedId(c.id)}
              />
            )}

            {!selectedContract ? (
              contracts.length > 1 && (
                <p className="text-muted-foreground text-sm">
                  Выберите договор в списке выше.
                </p>
              )
            ) : (
              <div className="space-y-4 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Договор № {selectedContract.number}
                  </p>
                  <Button size="sm" onClick={handleAdd}>
                    <PlusIcon size={16} />
                    Добавить платёж
                  </Button>
                </div>

                <DataTable
                  data={paymentsQuery.data?.results ?? []}
                  columns={paymentColumns}
                  isLoading={paymentsQuery.isLoading}
                  pagination={false}
                />

                <div>
                  <p className="mb-2 text-sm font-medium">
                    Квартальный план/факт
                  </p>
                  <QuarterlyFinanceTable contractId={selectedContract.id} />
                </div>
              </div>
            )}

            <PaymentForm
              open={drawerOpen}
              item={editingItem}
              fixedContract={selectedContract ?? undefined}
              onClose={() => setDrawerOpen(false)}
              onSuccess={invalidatePayments}
            />
          </>
        )}
      </CardContent>
    </SectionCard>
  );
};
