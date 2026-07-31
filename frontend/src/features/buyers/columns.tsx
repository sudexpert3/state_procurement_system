import type { ColumnDef } from "@tanstack/react-table";
import type { Buyer } from "@/shared/api/schema";

import { ArrowUpDownIcon, PencilIcon } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { DeleteButton } from "@/shared/components/ui/delete-button";

export const createColumns = (
  onEdit: (item: Buyer) => void,
  onDelete: (id: number) => void,
  getDeletingId: (id: number) => boolean,
): ColumnDef<Buyer>[] => [
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
          isPending={getDeletingId(row.original.id)}
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "shot_name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={column.getToggleSortingHandler()}>
        Фамилия и инициалы <ArrowUpDownIcon size={14} className="ml-1" />
      </Button>
    ),
  },
  {
    accessorKey: "full_name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={column.getToggleSortingHandler()}>
        ФИО полностью <ArrowUpDownIcon size={14} className="ml-1" />
      </Button>
    ),
  },
  {
    accessorKey: "is_active",
    header: "Статус",
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? "default" : "secondary"}>
        {row.original.is_active ? "Действующий" : "Не действующий"}
      </Badge>
    ),
  },
];
