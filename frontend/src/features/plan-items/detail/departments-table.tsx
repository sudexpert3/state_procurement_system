import type { ColumnDef } from "@tanstack/react-table";
import type { FinancingDepartment } from "./procurement.mock";

import { DataTable } from "@/shared/components/data-table/data-table";
import { CardHeader, CardTitle } from "@/shared/components/ui/card";
import { formatByn } from "@/shared/lib/helpers/format-money";

// Колонки таблицы подразделений (разбивка финансирования / позиции договора).
const columns: ColumnDef<FinancingDepartment, unknown>[] = [
  {
    accessorKey: "name",
    header: "Наименование подразделения",
  },
  {
    id: "quantity",
    header: "Количество",
    accessorFn: (row) => `${row.quantity} ${row.units}`,
  },
  {
    accessorKey: "totalSum",
    header: "Общая сумма",
    cell: ({ getValue }) => formatByn(getValue<number>()),
  },
  {
    accessorKey: "treasurySum",
    header: "Сумма казначейства",
    cell: ({ getValue }) => formatByn(getValue<number>()),
  },
  {
    accessorKey: "ownFunds",
    header: "Собственные средства",
    cell: ({ getValue }) => formatByn(getValue<number>()),
  },
  {
    accessorKey: "customerPaymentSum",
    header: "Оплата со счетов заказчика",
    cell: ({ getValue }) => formatByn(getValue<number>()),
  },
];

// Блок «таблица подразделений» с заголовком.
// Общий для табов «Информация» (финансирование по годам) и «Договоры» (позиции договора).
export const DepartmentsTable = ({
  title,
  data,
}: {
  title: string;
  data: FinancingDepartment[];
}) => (
  <div className="col-span-full mt-5 space-y-3">
    <CardHeader>
      <CardTitle className="text-base font-semibold tracking-wide uppercase">
        {title}
      </CardTitle>
    </CardHeader>
    <DataTable data={data} columns={columns} pagination={false} />
  </div>
);
