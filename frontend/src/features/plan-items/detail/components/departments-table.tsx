import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import type { CostDepartment } from "@/shared/api/schema";

import { DataTable } from "@/shared/components/data-table/data-table";
import {
  DataTableCell,
  DataTableColumnHeader,
} from "@/shared/components/data-table/data-table-cell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
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
  actions,
}: {
  title: string;
  data: CostDepartment[];
  actions?: ReactNode;
}) => (
  <Card className="col-span-full mt-2 p-0 pb-1 ring-0">
    <CardHeader className="flex justify-between px-2">
      <CardTitle className="text-base font-semibold tracking-wide uppercase">
        {title}
      </CardTitle>
      {actions}
    </CardHeader>
    <CardContent className="p-0">
      <DataTable
        data={data}
        columns={columns}
        pagination={false}
        cellClassName="text-center"
      />
    </CardContent>
  </Card>
);
