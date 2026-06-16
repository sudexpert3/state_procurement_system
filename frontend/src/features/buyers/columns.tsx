import type { ColumnDef } from "@tanstack/react-table";

import { ArrowUpDownIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { Badge } from "@/shared/ui/kit/badge";
import { Button } from "@/shared/ui/kit/button";

import type { BuyerItem } from "./buyer-form";

export const createColumns = (
  onEdit: (item: BuyerItem) => void,
  onDelete: (id: number) => void,
): ColumnDef<BuyerItem>[] => [
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(row.original.id)}>
          <Trash2Icon
            size={16}
            className="text-muted-foreground hover:text-destructive"
          />
        </Button>
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
