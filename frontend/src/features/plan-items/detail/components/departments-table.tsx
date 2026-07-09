import type { CostDepartment } from "@/shared/api/schema";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/shared/components/data-table/data-table";
import {
  DataTableCell,
  DataTableColumnHeader,
} from "@/shared/components/data-table/data-table-cell";
import { CardHeader, CardTitle } from "@/shared/components/ui/card";
import { formatByn } from "@/shared/lib/helpers/format-money";

const columns: ColumnDef<CostDepartment>[] = [
  {
    accessorKey: "department_detail.short_name",
    header: () => (
      <DataTableColumnHeader className="text-left">
        Наименование подразделения
      </DataTableColumnHeader>
    ),
    cell: ({ getValue }) => (
      <DataTableCell className="text-left">{getValue<string>()}</DataTableCell>
    ),
  },
  {
    accessorKey: "shared_amount",
    header: "Количество",
    cell: ({ getValue }) => {
      const value = getValue<string>() ?? "0.000";
      if (value.split(".")[1] !== "000") {
        return <DataTableCell>{value}</DataTableCell>;
      }
      return <DataTableCell>{Number(value).toFixed(0)}</DataTableCell>;
    },
  },
  {
    accessorKey: "",
    header: "Общая сумма",
    cell: ({ getValue }) => formatByn(getValue<number>()),
  },
  {
    accessorKey: "shared_cost",
    header: "Сумма со счетов казначейства",
    cell: ({ getValue }) => formatByn(getValue<number>()),
  },
  {
    accessorKey: "shared_inner_cost",
    header: "Собственные средства",
    cell: ({ getValue }) => (
      <DataTableCell>{formatByn(getValue<number>())}</DataTableCell>
    ),
  },
  {
    accessorKey: "shared_fund_cost",
    header: "Оплата со счетов заказчика",
    cell: ({ getValue }) => formatByn(getValue<number>()),
  },
];

export const DepartmentsTable = ({
  title,
  data,
}: {
  title: string;
  data: CostDepartment[];
}) => (
  <div className="col-span-full mt-5 space-y-3">
    <CardHeader>
      <CardTitle className="text-base font-semibold tracking-wide uppercase">
        {title}
      </CardTitle>
    </CardHeader>
    <DataTable
      data={data}
      columns={columns}
      pagination={false}
      cellClassName="text-center"
    />
  </div>
);
