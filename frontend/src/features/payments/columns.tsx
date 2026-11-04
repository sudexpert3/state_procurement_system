import type { ColumnDef } from "@tanstack/react-table";
import type { TreasuryPayment } from "@/shared/api/schema";

import { PencilIcon } from "lucide-react";

import { DataTableCell } from "@/shared/components/data-table/data-table-cell";
import { DeleteButton } from "@/shared/components/delete-button";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatDate } from "@/shared/lib/helpers/format-date";
import { formatByn } from "@/shared/lib/helpers/format-money";

export const createColumns = (
  onEdit: (item: TreasuryPayment) => void,
  onDelete: (id: number) => void,
  deletingId?: number | null,
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
    cell: ({ getValue }) => (
      <DataTableCell>
        {formatDate(getValue<string | undefined>())}
      </DataTableCell>
    ),
  },
  {
    id: "type",
    header: "Тип",
    cell: ({ row }) => (
      <DataTableCell>
        {row.original.contract ? (
          <Badge variant="secondary">По договору</Badge>
        ) : (
          <Badge variant="outline">Свободный платёж</Badge>
        )}
      </DataTableCell>
    ),
  },
  {
    id: "departments",
    header: "Подразделения",
    cell: ({ row }) => (
      <DataTableCell>
        {row.original.departments_detail.map((d) => d.short_name).join(", ") ||
          "—"}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "amount",
    header: "Сумма",
    cell: ({ getValue }) => (
      <DataTableCell>{formatByn(getValue<string>())}</DataTableCell>
    ),
  },
  {
    id: "kind",
    header: "Вид платежа",
    cell: ({ row }) => (
      <DataTableCell>{row.original.kind_detail?.name ?? "—"}</DataTableCell>
    ),
  },
  {
    accessorKey: "notice",
    header: "Примечание",
    cell: ({ getValue }) => (
      <DataTableCell className="max-w-xs truncate">
        {getValue<string | null>() ?? "—"}
      </DataTableCell>
    ),
  },
];
