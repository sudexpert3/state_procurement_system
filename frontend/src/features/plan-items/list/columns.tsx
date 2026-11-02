import type { ColumnDef } from "@tanstack/react-table";
import type { PlanItemShort } from "@/shared/api/schema";

import {
  DataTableCell,
  DataTableCellList,
  DataTableColumnHeader,
} from "@/shared/components/data-table/data-table-cell";
import { formatMoney } from "@/shared/lib/helpers/format-money";

export const createColumns = (): ColumnDef<PlanItemShort>[] => [
  {
    accessorKey: "num",
    header: () => (
      <DataTableColumnHeader className="text-left">
        Номер пункта
      </DataTableColumnHeader>
    ),
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
    header: () => <DataTableColumnHeader>Общая сумма</DataTableColumnHeader>,
    cell: ({ row }) => (
      <DataTableCell>
        {formatMoney(Number(row.getValue("aggregated_cost")))}
      </DataTableCell>
    ),
  },
  {
    id: "years",
    accessorFn: (row) => row.economic_details.map((d) => d.year ?? "—"),
    header: () => (
      <DataTableColumnHeader>Годы финансирования</DataTableColumnHeader>
    ),
    cell: ({ getValue }) => (
      <DataTableCellList items={getValue<(string | number)[]>()} />
    ),
  },
  {
    id: "full_cost",
    accessorFn: (row) =>
      row.economic_details.map((d) => formatMoney(Number(d.full_cost)) ?? "—"),
    header: () => <DataTableColumnHeader>Сумма по годам</DataTableColumnHeader>,
    cell: ({ getValue }) => <DataTableCellList items={getValue<string[]>()} />,
  },
  {
    id: "functional_code",
    accessorFn: (row) =>
      row.economic_details.map((d) => d.functional_code ?? "—"),
    header: () => (
      <DataTableColumnHeader>Функциональный код</DataTableColumnHeader>
    ),
    cell: ({ getValue }) => (
      <DataTableCellList items={getValue<(string | number)[]>()} />
    ),
  },
  {
    id: "economic_code",
    accessorFn: (row) =>
      row.economic_details.map((d) => d.economic_code ?? "—"),
    header: () => (
      <DataTableColumnHeader>Экономический код</DataTableColumnHeader>
    ),
    cell: ({ getValue }) => (
      <DataTableCellList items={getValue<(string | number)[]>()} />
    ),
  },
  {
    id: "internal_economic_class_detail",
    accessorFn: (row) =>
      row.economic_details.map((d) => {
        const ecr = d.internal_economic_class_detail;
        if (!ecr || !ecr.code || !ecr.name) {
          return "—";
        }
        return `${ecr.code} - ${ecr.name}`;
      }),
    header: () => <DataTableColumnHeader>ЭКР внутренний</DataTableColumnHeader>,
    cell: ({ getValue }) => (
      <DataTableCellList
        className="mx-auto max-w-[218px] wrap-break-word whitespace-normal"
        items={getValue<(string | number)[]>()}
      />
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
