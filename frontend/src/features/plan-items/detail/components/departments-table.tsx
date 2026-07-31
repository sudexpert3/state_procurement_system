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
  CardAction,
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
      const value = Number(getValue<number | string>() ?? 0);
      return (
        <DataTableCell>
          {value.toLocaleString("ru-RU", { maximumFractionDigits: 3 })}
        </DataTableCell>
      );
    },
  },
  {
    accessorKey: "total_shared_cost",
    header: "Общая сумма",
    cell: ({ getValue }) => formatByn(getValue<number>()),
  },
  {
    accessorKey: "shared_cost",
    header: "Сумма со счетов казначейства",
    cell: ({ getValue }) => formatByn(getValue<string>()),
  },
  {
    accessorKey: "shared_inner_cost",
    header: "Собственные средства",
    cell: ({ getValue }) => (
      <DataTableCell>{formatByn(getValue<string>())}</DataTableCell>
    ),
  },
  {
    accessorKey: "shared_fund_cost",
    header: "Оплата со счетов заказчика",
    cell: ({ getValue }) => formatByn(getValue<string>()),
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
  <Card className="col-span-full mt-2 gap-2 p-0 pb-1 ring-0">
    <CardHeader className="flex items-center justify-between px-0">
      <CardTitle className="text-base font-semibold tracking-wide uppercase">
        {title}
      </CardTitle>
      <CardAction>{actions}</CardAction>
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
