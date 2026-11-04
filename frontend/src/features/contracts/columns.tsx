import type { ColumnDef } from "@tanstack/react-table";
import type { Contract } from "@/shared/api/schema";

import { EyeIcon } from "lucide-react";

import { DataTableCell } from "@/shared/components/data-table/data-table-cell";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatDate } from "@/shared/lib/helpers/format-date";
import { formatByn } from "@/shared/lib/helpers/format-money";

export const createColumns = (
  onOpen: (item: Contract) => void,
): ColumnDef<Contract>[] => [
  {
    accessorKey: "number",
    header: "№ договора",
    cell: ({ getValue }) => <DataTableCell>{getValue<string>()}</DataTableCell>,
  },
  {
    accessorKey: "contract_date",
    header: "Дата заключения",
    cell: ({ getValue }) => (
      <DataTableCell>
        {formatDate(getValue<string | undefined>())}
      </DataTableCell>
    ),
  },
  {
    id: "supplier",
    header: "Контрагент",
    cell: ({ row }) => (
      <DataTableCell>{row.original.supplier_detail.name}</DataTableCell>
    ),
  },
  {
    accessorKey: "total_cost",
    header: "Сумма договора",
    cell: ({ getValue }) => (
      <DataTableCell>{formatByn(getValue<string>())}</DataTableCell>
    ),
  },
  {
    accessorKey: "planned_delivery_date",
    header: "Плановая дата исполнения",
    cell: ({ row }) => (
      <DataTableCell className="flex items-center gap-2">
        {formatDate(row.original.planned_delivery_date)}
        {row.original.is_urgent_warning && (
          <Badge variant="destructive">
            Осталось {row.original.days_remaining} дн.
          </Badge>
        )}
      </DataTableCell>
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
