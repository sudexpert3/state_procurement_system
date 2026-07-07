import type { PlanItemShort } from "@/shared/api/schema";
import type { ColumnDef } from "@tanstack/react-table";

import {
  DataTableCell,
  DataTableCellList,
  DataTableColumnHeader,
} from "@/shared/components/data-table/data-table-cell";
import { formatMoney } from "@/shared/lib/helpers/format-money";

export const createColumns = (): ColumnDef<PlanItemShort>[] => [
  {
    accessorKey: "num",
    header: () => <DataTableColumnHeader>Номер пункта</DataTableColumnHeader>,
    size: 30,
    cell: ({ row }) => (
      <DataTableCell className="text-left font-medium wrap-break-word whitespace-normal">
        {row.getValue("num")}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "title",
    header: () => (
      <DataTableColumnHeader className="text-left wrap-break-word whitespace-normal">
        Наименование товара
      </DataTableColumnHeader>
    ),
    size: 280,
    cell: ({ row }) => (
      <DataTableCell className="text-left wrap-break-word whitespace-normal">
        {row.getValue("title")}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "val_amount",
    header: () => <DataTableColumnHeader>Кол-во</DataTableColumnHeader>,
  },
  {
    accessorKey: "val_unit",
    header: () => <DataTableColumnHeader>Ед. измерения</DataTableColumnHeader>,
  },
  {
    accessorKey: "aggregated_cost",
    header: () => <DataTableColumnHeader>Сумма</DataTableColumnHeader>,
    cell: ({ row }) => (
      <DataTableCell>
        {formatMoney(row.getValue("aggregated_cost"))}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "years",
    header: () => (
      <DataTableColumnHeader>Годы финансирования</DataTableColumnHeader>
    ),
    cell: ({ row }) => (
      <DataTableCellList items={row.getValue<number[]>("years")} />
    ),
  },
  {
    accessorKey: "functional_codes_api",
    header: () => (
      <DataTableColumnHeader>Функциональный код</DataTableColumnHeader>
    ),
    cell: ({ row }) => (
      <DataTableCellList
        items={row.getValue<string[]>("functional_codes_api")}
      />
    ),
  },
  {
    accessorKey: "economic_codes_api",
    header: () => (
      <DataTableColumnHeader>Экономический код</DataTableColumnHeader>
    ),
    cell: ({ row }) => (
      <DataTableCellList items={row.getValue<string[]>("economic_codes_api")} />
    ),
  },

  {
    accessorKey: "contracts",
    header: () => (
      <DataTableColumnHeader>Наличие договора</DataTableColumnHeader>
    ),
    cell: ({ row }) => {
      const isExists: boolean = row.getValue("contracts");

      return (
        <DataTableCell className="text-center">
          {isExists && <span className="bg-green-200 text-center">Да</span>}
          {!isExists && <span className="text-center">Нет</span>}
        </DataTableCell>
      );
    },
  },
];
