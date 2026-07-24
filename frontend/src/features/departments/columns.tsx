import type { ColumnDef } from "@tanstack/react-table";
import type { Department } from "@/shared/api/schema";

import { ChevronRightIcon, PencilIcon } from "lucide-react";

import {
  DataTableCell,
  DataTableColumnHeader,
} from "@/shared/components/data-table/data-table-cell";
import { DeleteButton } from "@/shared/components/delete-button";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

export const createColumns = (
  onEdit: (item: Department) => void,
  onDelete: (id: number) => void,
  deletingId?: number | null,
): ColumnDef<Department>[] => [
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
    enableGlobalFilter: false,
  },
  {
    accessorKey: "short_name",
    header: () => (
      <DataTableColumnHeader className="text-left">
        Краткое наименование
      </DataTableColumnHeader>
    ),
    cell: ({ row, getValue }) => (
      <DataTableCell
        className="flex items-center gap-1 text-left"
        style={{ paddingLeft: row.depth * 24 }}>
        {row.getCanExpand() ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            onClick={row.getToggleExpandedHandler()}>
            <ChevronRightIcon
              size={16}
              className={cn(
                "text-muted-foreground transition-transform",
                row.getIsExpanded() && "rotate-90",
              )}
            />
          </Button>
        ) : (
          <span className="size-6 shrink-0" />
        )}
        {getValue<string>()}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "full_name",
    header: () => (
      <DataTableColumnHeader className="text-left">
        Полное наименование
      </DataTableColumnHeader>
    ),
    cell: ({ getValue }) => (
      <DataTableCell className="text-left wrap-break-word whitespace-normal">
        {getValue<string>()}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "is_active",
    header: () => <DataTableColumnHeader>Статус</DataTableColumnHeader>,
    enableGlobalFilter: false,
    cell: ({ row }) => (
      <DataTableCell>
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? "Действующее" : "Не действующее"}
        </Badge>
      </DataTableCell>
    ),
  },
];
