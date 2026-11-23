import type { ColumnDef } from "@tanstack/react-table";
import type { Supplier } from "@/shared/api/schema";

import { ArrowUpDownIcon, PencilIcon } from "lucide-react";

import { DeleteButton } from "@/shared/components/delete-button";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

export const createColumns = (
  onEdit: (item: Supplier) => void,
  onDelete: (id: number) => void,
  deletingId?: number | null,
): ColumnDef<Supplier>[] => [
  {
    id: "actions",
    cell: ({ row }) => (
      <div className="flex gap-1">
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
      </div>
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
        className="-ml-3"
        onClick={column.getToggleSortingHandler()}>
        Наименование <ArrowUpDownIcon size={14} className="ml-1" />
      </Button>
    ),
  },
  {
    accessorKey: "unp",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={column.getToggleSortingHandler()}>
        УНП <ArrowUpDownIcon size={14} className="ml-1" />
      </Button>
    ),
    cell: ({ getValue }) => {
      const unp = getValue<string | null>();
      return unp ? (
        unp
      ) : (
        <Badge variant="destructive" className="text-sm">
          нет УНП
        </Badge>
      );
    },
  },
];
