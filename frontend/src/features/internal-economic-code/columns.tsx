import type { ColumnDef } from "@tanstack/react-table";
import type { InternalEconomicCode } from "@/shared/api/schema";
import type { InternalEconomicCodeRow } from "./hooks/use-internal-economic-code";

import { PencilIcon } from "lucide-react";

import {
  DataTableCell,
  DataTableColumnHeader,
} from "@/shared/components/data-table/data-table-cell";
import { DeleteButton } from "@/shared/components/delete-button";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

export const createColumns = (
  onEdit: (item: InternalEconomicCode) => void,
  onDelete: (id: number) => void,
  deletingId?: number | null,
): ColumnDef<InternalEconomicCodeRow>[] => [
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
    size: 30,
    cell: ({ row, getValue }) => (
      <DataTableCell
        className="text-left font-mono"
        style={{ paddingLeft: row.original.level * 16 }}>
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
      <DataTableCell className="text-left wrap-break-word whitespace-normal">
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
