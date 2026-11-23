import type { ColumnDef } from "@tanstack/react-table";
import type { DepartmentArticleLimit } from "@/shared/api/schema";

import { PencilIcon } from "lucide-react";

import { DataTableCell } from "@/shared/components/data-table/data-table-cell";
import { DeleteButton } from "@/shared/components/delete-button";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatByn } from "@/shared/lib/helpers/format-money";

const STATUS_BADGE_VARIANT = {
  DRAFT: "secondary",
  ACTIVE: "outline",
  ARCHIVE: "destructive",
} as const;

// Своя подпись вместо `status_display` с бэкенда (там «Актуальный (Доступен
// для договоров)») — приведена к единому наименованию с фильтром статуса
// («Действующий» и там, и там, по просьбе пользователя).
const STATUS_LABELS = {
  DRAFT: "Черновик",
  ACTIVE: "Действующий",
  ARCHIVE: "Архив",
} as const;

export const createColumns = (
  onEdit: (item: DepartmentArticleLimit) => void,
  onDelete: (id: number) => void,
  deletingId?: number | null,
): ColumnDef<DepartmentArticleLimit>[] => [
  {
    id: "actions",
    size: 70,
    cell: ({ row }) => (
      <DataTableCell>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(row.original)}>
          <PencilIcon size={16} className="text-muted-foreground" />
        </Button>
        {row.original.status === "DRAFT" && (
          <DeleteButton
            onConfirm={() => onDelete(row.original.id)}
            isPending={deletingId === row.original.id}
            description="Черновик записи будет удалён безвозвратно."
          />
        )}
      </DataTableCell>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "status",
    header: "Статус",
    cell: ({ row }) => (
      <Badge variant={STATUS_BADGE_VARIANT[row.original.status]}>
        {STATUS_LABELS[row.original.status]}
      </Badge>
    ),
  },
  {
    accessorKey: "economic_code",
    header: "Статья",
    cell: ({ getValue }) => (
      <DataTableCell className="text-left">{getValue<string>()}</DataTableCell>
    ),
  },
  {
    accessorKey: "functional_code",
    header: "Параграф",
    cell: ({ getValue }) => (
      <DataTableCell className="text-left">{getValue<string>()}</DataTableCell>
    ),
  },
  {
    id: "internal_economic_class",
    header: "Внутренний код ЭКР",
    cell: ({ row }) => (
      <DataTableCell className="flex flex-col items-start text-left">
        <span>{row.original.internal_economic_class_code}</span>
        <span className="text-muted-foreground text-xs">
          {row.original.internal_economic_class_name}
        </span>
      </DataTableCell>
    ),
  },
  {
    accessorKey: "department_name",
    header: "Подразделение",
    cell: ({ getValue }) => (
      <DataTableCell className="text-left">{getValue<string>()}</DataTableCell>
    ),
  },
  {
    accessorKey: "amount",
    header: "Сумма лимита",
    cell: ({ getValue }) => (
      <DataTableCell className="font-medium">
        {formatByn(getValue<string>())}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "plan_amount",
    header: "Сумма позиций в плане",
    cell: ({ getValue }) => (
      <DataTableCell>{formatByn(getValue<string>())}</DataTableCell>
    ),
  },
  {
    accessorKey: "paid_amount",
    header: "Сумма факт. оплат",
    cell: ({ getValue }) => (
      <DataTableCell>{formatByn(getValue<string>())}</DataTableCell>
    ),
  },
  {
    accessorKey: "note",
    header: "Примечание",
    cell: ({ getValue }) => (
      <DataTableCell className="text-left">
        {getValue<string>() || "—"}
      </DataTableCell>
    ),
  },
];
