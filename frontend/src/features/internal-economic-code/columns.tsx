import type { InternalEconomicCode } from "@/shared/api/schema";
import type { ColumnDef } from "@tanstack/react-table";

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
  onEdit: (item: InternalEconomicCode) => void,
  onDelete: (id: number) => void,
  deletingId?: number | null,
): ColumnDef<InternalEconomicCode>[] => [
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
    header: () => (
      <DataTableColumnHeader className="text-left">Код</DataTableColumnHeader>
    ),
    cell: ({ row, getValue }) => (
      <DataTableCell
        className="flex items-center gap-1 text-left font-mono"
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
          // Заглушка вместо кнопки — выравнивание кодов без потомков
          <span className="size-6 shrink-0" />
        )}
        {getValue<string>()}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "name",
    header: () => (
      <DataTableColumnHeader className="text-left">
        Наименование
      </DataTableColumnHeader>
    ),
    cell: ({ getValue }) => (
      <DataTableCell className="max-w-125 text-left wrap-break-word whitespace-normal">
        {getValue<string>()}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "is_active",
    header: () => <DataTableColumnHeader>Статус</DataTableColumnHeader>,
    cell: ({ row }) => (
      <DataTableCell>
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? "Действующий" : "Не действующий"}
        </Badge>
      </DataTableCell>
    ),
  },
];
