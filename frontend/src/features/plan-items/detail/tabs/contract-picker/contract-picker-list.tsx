import type { ColumnDef } from "@tanstack/react-table";
import type { Contract } from "@/shared/api/schema";

import { DataTable } from "@/shared/components/data-table/data-table";
import { Badge } from "@/shared/components/ui/badge";
import { formatDate } from "@/shared/lib/helpers/format-date";
import { formatByn } from "@/shared/lib/helpers/format-money";

const columns: ColumnDef<Contract>[] = [
  { accessorKey: "number", header: "№ договора" },
  {
    accessorKey: "contract_date",
    header: "Дата заключения",
    cell: ({ getValue }) => formatDate(getValue<string | undefined>()),
  },
  {
    id: "supplier",
    header: "Поставщик",
    cell: ({ row }) => row.original.supplier_detail.name,
  },
  {
    accessorKey: "total_cost",
    header: "Сумма договора",
    cell: ({ getValue }) => formatByn(getValue<string>()),
  },
  {
    id: "urgent",
    header: "",
    cell: ({ row }) =>
      row.original.is_urgent_warning ? (
        <Badge variant="destructive">
          Осталось {row.original.days_remaining} дн.
        </Badge>
      ) : null,
  },
];

/** Кликабельный список договоров пункта плана — показывается, когда их больше одного. */
export const ContractPickerList = ({
  contracts,
  onSelect,
}: {
  contracts: Contract[];
  onSelect: (contract: Contract) => void;
}) => (
  <DataTable
    data={contracts}
    columns={columns}
    pagination={false}
    getRow={onSelect}
  />
);
