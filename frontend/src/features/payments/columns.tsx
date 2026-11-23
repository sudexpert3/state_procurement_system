import type { ColumnDef } from "@tanstack/react-table";
import type { TreasuryPayment } from "@/shared/api/schema";

import { PencilIcon } from "lucide-react";

import { DataTableCell } from "@/shared/components/data-table/data-table-cell";
import { DeleteButton } from "@/shared/components/delete-button";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { formatDate } from "@/shared/lib/helpers/format-date";
import { formatByn } from "@/shared/lib/helpers/format-money";

export const createColumns = (
  onEdit: (item: TreasuryPayment) => void,
  onDelete: (id: number) => void,
  deletingId?: number | null,
): ColumnDef<TreasuryPayment>[] => [
  {
    id: "actions",
    size: 50,
    // Строка целиком кликабельна (открывает тот же Drawer с полной
    // информацией, см. payments.page.tsx `getRow`) — stopPropagation здесь
    // не даёт клику по кнопкам "провалиться" в обработчик строки и, для
    // корзины, случайно открыть Drawer вместо диалога подтверждения удаления.
    cell: ({ row }) => (
      <DataTableCell onClick={(e) => e.stopPropagation()}>
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
    accessorKey: "payment_date",
    header: "Дата",
    cell: ({ getValue }) => (
      <DataTableCell>
        {formatDate(getValue<string | undefined>())}
      </DataTableCell>
    ),
  },
  {
    id: "type",
    header: "Тип",
    cell: ({ row }) => (
      <DataTableCell>
        {row.original.contract ? (
          <Badge variant="secondary">По договору</Badge>
        ) : (
          <Badge variant="outline">Свободный платёж</Badge>
        )}
      </DataTableCell>
    ),
  },
  {
    id: "departments",
    header: "Подразделения",
    cell: ({ row }) => (
      <DataTableCell>
        {row.original.departments_detail.map((d) => d.short_name).join(", ") ||
          "—"}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "amount",
    header: "Сумма",
    cell: ({ getValue }) => (
      <DataTableCell>{formatByn(getValue<string>())}</DataTableCell>
    ),
  },
  {
    id: "kind",
    header: "Вид платежа",
    cell: ({ row }) => {
      const kind = row.original.kind_detail;
      return (
        <DataTableCell className="flex items-center gap-1">
          {kind?.name ?? "—"}
          {kind?.is_refund && (
            <Badge variant="destructive" className="text-xs">
              Возврат
            </Badge>
          )}
        </DataTableCell>
      );
    },
  },
  {
    accessorKey: "notice",
    header: "Примечание",
    cell: ({ getValue }) => {
      const notice = getValue<string | null>();
      if (!notice) return <DataTableCell>—</DataTableCell>;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <DataTableCell className="max-w-xs cursor-default truncate">
              {notice}
            </DataTableCell>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">{notice}</TooltipContent>
        </Tooltip>
      );
    },
  },
];
