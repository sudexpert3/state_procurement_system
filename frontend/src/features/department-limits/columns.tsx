import type { ColumnDef } from "@tanstack/react-table";
import type { DepartmentArticleLimit } from "@/shared/api/schema";

import { PencilIcon } from "lucide-react";

import { DataTableCell } from "@/shared/components/data-table/data-table-cell";
import { DeleteButton } from "@/shared/components/delete-button";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatDate } from "@/shared/lib/helpers/format-date";
import { formatByn } from "@/shared/lib/helpers/format-money";

// Свои цвета вместо стандартных вариантов Badge (secondary/outline/destructive) —
// тот же приём, что в plan-meta.ts: border+bg+text, включая dark-вариант.
const STATUS_BADGE_CLASSNAME = {
  DRAFT:
    "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  ACTIVE:
    "border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
  ARCHIVE:
    "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
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
      <DataTableCell className="flex flex-col items-start gap-1">
        <Badge
          variant="outline"
          className={STATUS_BADGE_CLASSNAME[row.original.status]}>
          {STATUS_LABELS[row.original.status]}
        </Badge>
        {/* effective_date — дата, с которой запись реально действует: для
            DRAFT ещё не значима (запись не действует), для ACTIVE/ARCHIVE
            это и есть фактическая дата активации (поле блокируется сразу
            после активации, см. department-limit-form.tsx/isLocked). */}
        {row.original.status === "ACTIVE" && (
          <span className="text-muted-foreground text-xs">
            {formatDate(row.original.effective_date)}
          </span>
        )}
        {row.original.status === "ARCHIVE" && (
          <span className="text-muted-foreground text-xs">
            {formatDate(row.original.effective_date)}-
            {formatDate(row.original.deactivated_at)}
          </span>
        )}
      </DataTableCell>
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
    // Фиксированная ширина + перенос строки: `internal_economic_class_name`
    // (`name` в модели — TextField, длина не ограничена) раньше рисовался в
    // одну строку и растягивал колонку (и всю таблицу) настолько, что
    // появлялся горизонтальный скролл — см. тот же приём в
    // internal-economic-code/columns.tsx.
    size: 220,
    cell: ({ row }) => (
      <DataTableCell className="flex max-w-55 flex-col text-left">
        <span>{row.original.internal_economic_class_code}</span>
        <span className="text-muted-foreground text-xs wrap-break-word whitespace-normal">
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
    // `note` — тоже TextField без ограничения длины (как и имя ЭКР внутреннего
    // кода выше), по той же причине ограничиваем ширину и переносим строки.
    size: 160,
    cell: ({ getValue }) => (
      <DataTableCell className="max-w-40 text-left wrap-break-word whitespace-normal">
        {getValue<string>() || "—"}
      </DataTableCell>
    ),
  },
];
