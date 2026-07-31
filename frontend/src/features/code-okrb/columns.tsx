import type { ColumnDef } from "@tanstack/react-table";
import type { OkrbProduct } from "@/shared/api/schema";

import { ArrowUpDownIcon, PencilIcon } from "lucide-react";

import { DataTableCell } from "@/shared/components/data-table/data-table-cell";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { DeleteButton } from "@/shared/components/ui/delete-button";

export const createColumns = (
  onEdit: (item: OkrbProduct) => void,
  onDelete: (id: number) => void,
  deletingId?: number | null,
): ColumnDef<OkrbProduct>[] => [
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
    accessorKey: "code",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={column.getToggleSortingHandler()}>
        Код <ArrowUpDownIcon size={14} className="ml-1" />
      </Button>
    ),
    size: 30,
    cell: ({ getValue }) => <DataTableCell>{getValue<string>()}</DataTableCell>,
  },
  {
    accessorKey: "title",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="p-0"
        onClick={column.getToggleSortingHandler()}>
        Наименование <ArrowUpDownIcon size={14} className="ml-1" />
      </Button>
    ),
    cell: ({ getValue }) => (
      <DataTableCell className="wrap-break-word whitespace-normal">
        {getValue<string>()}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "is_active",
    header: "Статус",
    cell: ({ row }) => (
      <DataTableCell>
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? "Действующий" : "Не действующий"}
        </Badge>
      </DataTableCell>
    ),
  },
];
