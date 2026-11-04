import type { ColumnDef } from "@tanstack/react-table";
import type { ChangeRequest } from "@/services/change-requests";

import { EyeIcon } from "lucide-react";

import {
  CHANGE_REQUEST_KIND_LABELS,
  CHANGE_REQUEST_STATUS_BADGE_VARIANT,
  CHANGE_REQUEST_STATUS_LABELS,
} from "@/services/change-requests";
import { DataTableCell } from "@/shared/components/data-table/data-table-cell";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatDate } from "@/shared/lib/helpers/format-date";

export const createColumns = (
  onOpen: (item: ChangeRequest) => void,
): ColumnDef<ChangeRequest>[] => [
  {
    accessorKey: "id",
    header: "№",
    size: 60,
    cell: ({ getValue }) => <DataTableCell>{getValue<number>()}</DataTableCell>,
  },
  {
    accessorKey: "kind",
    header: "Вид заявки",
    cell: ({ row }) => (
      <DataTableCell>
        {CHANGE_REQUEST_KIND_LABELS[row.original.kind]}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "plan_item_num",
    header: "Позиция плана",
    cell: ({ getValue }) => (
      <DataTableCell>{getValue<string>() || "—"}</DataTableCell>
    ),
  },
  {
    accessorKey: "status",
    header: "Статус",
    cell: ({ row }) => (
      <DataTableCell>
        <Badge
          variant={CHANGE_REQUEST_STATUS_BADGE_VARIANT[row.original.status]}>
          {CHANGE_REQUEST_STATUS_LABELS[row.original.status]}
        </Badge>
      </DataTableCell>
    ),
  },
  {
    accessorKey: "reason",
    header: "Обоснование",
    cell: ({ getValue }) => (
      <DataTableCell className="max-w-xs truncate">
        {getValue<string>() || "—"}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "submitted_at",
    header: "Отправлена",
    cell: ({ getValue }) => (
      <DataTableCell>{formatDate(getValue<string | null>())}</DataTableCell>
    ),
  },
  {
    accessorKey: "reviewed_at",
    header: "Решение",
    cell: ({ getValue }) => (
      <DataTableCell>{formatDate(getValue<string | null>())}</DataTableCell>
    ),
  },
  {
    id: "actions",
    size: 50,
    cell: ({ row }) => (
      <DataTableCell>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpen(row.original)}>
          <EyeIcon size={16} className="text-muted-foreground" />
        </Button>
      </DataTableCell>
    ),
    enableSorting: false,
    enableHiding: false,
  },
];
