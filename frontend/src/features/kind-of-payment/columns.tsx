import type { ColumnDef } from "@tanstack/react-table";
import type { KindOfPayment } from "@/shared/api/schema";

import { ArrowUpDownIcon, PencilIcon } from "lucide-react";

import { DataTableCell } from "@/shared/components/data-table/data-table-cell";
import { DeleteButton } from "@/shared/components/delete-button";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

export const createColumns = (
  onEdit: (item: KindOfPayment) => void,
  onDelete: (id: number) => void,
  deletingId?: number | null,
): ColumnDef<KindOfPayment>[] => [
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
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="p-0"
        onClick={column.getToggleSortingHandler()}>
        Вид платежа <ArrowUpDownIcon size={14} className="ml-1" />
      </Button>
    ),
    cell: ({ getValue }) => <DataTableCell>{getValue<string>()}</DataTableCell>,
  },
  {
    accessorKey: "is_refund",
    header: "Тип",
    cell: ({ row }) => (
      <DataTableCell>
        {row.original.is_refund ? (
          <Badge variant="destructive">Возврат</Badge>
        ) : (
          <Badge variant="secondary">Обычный</Badge>
        )}
      </DataTableCell>
    ),
  },
];
