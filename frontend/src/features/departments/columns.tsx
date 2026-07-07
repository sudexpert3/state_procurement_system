import type { ColumnDef } from "@tanstack/react-table";
import type { Department } from "@/shared/api/schema";

import { ArrowUpDownIcon, PencilIcon } from "lucide-react";

import { DeleteButton } from "@/shared/components/delete-button";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

export const createColumns = (
  onEdit: (item: Department) => void,
  onDelete: (id: number) => void,
  parentNameById: Map<number, string>,
  deletingId?: number | null,
): ColumnDef<Department>[] => [
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
    accessorKey: "full_name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={column.getToggleSortingHandler()}>
        Полное наименование <ArrowUpDownIcon size={14} className="ml-1" />
      </Button>
    ),
  },
  {
    accessorKey: "short_name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={column.getToggleSortingHandler()}>
        Краткое наименование <ArrowUpDownIcon size={14} className="ml-1" />
      </Button>
    ),
  },
  {
    accessorKey: "parent",
    header: "Вышестоящее",
    cell: ({ row }) => {
      const parentId = row.original.parent;
      if (parentId == null) return "—";
      return parentNameById.get(parentId) ?? `#${parentId}`;
    },
  },
  {
    accessorKey: "is_active",
    header: "Статус",
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? "default" : "secondary"}>
        {row.original.is_active ? "Действующее" : "Не действующее"}
      </Badge>
    ),
  },
];
