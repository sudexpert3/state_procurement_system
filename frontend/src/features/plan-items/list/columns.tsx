import type { ColumnDef } from "@tanstack/react-table";
import type { PlanItemShort } from "@/shared/api/schema";

import {
  DataTableCell,
  DataTableCellList,
  DataTableColumnHeader,
} from "@/shared/components/data-table/data-table-cell";
import { Badge } from "@/shared/components/ui/badge";
import { formatMoney } from "@/shared/lib/helpers/format-money";

export const createColumns = (): ColumnDef<PlanItemShort>[] => [
  {
    accessorKey: "num",
    header: () => (
      <DataTableColumnHeader className="text-left">
        Номер пункта
      </DataTableColumnHeader>
    ),
    meta: { label: "Номер пункта" },
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
    meta: { label: "Наименование товара" },
    size: 400,
    cell: ({ row }) => (
      <DataTableCell className="text-left wrap-break-word whitespace-normal">
        {row.getValue("title")}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "val_amount",
    header: () => <DataTableColumnHeader>Кол-во</DataTableColumnHeader>,
    meta: { label: "Кол-во" },
  },
  {
    accessorKey: "val_unit",
    header: () => <DataTableColumnHeader>Ед.изм.</DataTableColumnHeader>,
    meta: { label: "Ед.изм." },
    size: 70,
  },
  {
    accessorKey: "aggregated_cost",
    header: () => <DataTableColumnHeader>Общая сумма</DataTableColumnHeader>,
    meta: { label: "Общая сумма" },
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
      <DataTableColumnHeader>
        Годы
        <br />
        финансирования
      </DataTableColumnHeader>
    ),
    meta: { label: "Годы финансирования" },
    size: 90,
    cell: ({ getValue }) => (
      <DataTableCellList items={getValue<(string | number)[]>()} />
    ),
  },
  {
    id: "full_cost",
    accessorFn: (row) =>
      row.economic_details.map((d) => formatMoney(Number(d.full_cost)) ?? "—"),
    header: () => <DataTableColumnHeader>Сумма по годам</DataTableColumnHeader>,
    meta: { label: "Сумма по годам" },
    cell: ({ getValue }) => <DataTableCellList items={getValue<string[]>()} />,
  },
  {
    id: "functional_code",
    accessorFn: (row) =>
      row.economic_details.map((d) => d.functional_code ?? "—"),
    header: () => (
      <DataTableColumnHeader>
        Функциональный
        <br />
        код
      </DataTableColumnHeader>
    ),
    meta: { label: "Функциональный код" },
    size: 100,
    cell: ({ getValue }) => (
      <DataTableCellList items={getValue<(string | number)[]>()} />
    ),
  },
  {
    id: "economic_code",
    accessorFn: (row) =>
      row.economic_details.map((d) => d.economic_code ?? "—"),
    header: () => (
      <DataTableColumnHeader>
        Экономический
        <br />
        код
      </DataTableColumnHeader>
    ),
    meta: { label: "Экономический код" },
    size: 90,
    cell: ({ getValue }) => (
      <DataTableCellList items={getValue<(string | number)[]>()} />
    ),
  },
  // "ЭКР внутренний" разбит на два параллельных столбца (код / название) —
  // по тому же паттерну, что уже применён выше для пары
  // "Годы финансирования" + "Сумма по годам": оба столбца перечисляют
  // economic_details в одном порядке, поэтому строки кода и названия
  // остаются на одной высоте без отдельной вложенной таблицы в ячейке.
  {
    id: "internal_economic_code",
    accessorFn: (row) =>
      row.economic_details.map(
        (d) => d.internal_economic_class_detail?.code ?? "—",
      ),
    header: () => (
      <DataTableColumnHeader>
        Код ЭКР
        <br />
        внутренний
      </DataTableColumnHeader>
    ),
    meta: { label: "Код ЭКР внутренний" },
    size: 100,
    cell: ({ getValue }) => (
      <DataTableCellList items={getValue<(string | number)[]>()} />
    ),
  },
  {
    id: "internal_economic_name",
    accessorFn: (row) =>
      row.economic_details.map(
        (d) => d.internal_economic_class_detail?.name ?? "—",
      ),
    header: () => (
      <DataTableColumnHeader>Наименование ЭКР внутренний</DataTableColumnHeader>
    ),
    meta: { label: "Наименование ЭКР внутренний" },
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
      <DataTableColumnHeader>
        Наличие
        <br />
        договора
      </DataTableColumnHeader>
    ),
    meta: { label: "Наличие договора" },
    size: 90,
    cell: ({ row }) => {
      const isExists: boolean = row.getValue("contracts");

      return (
        <DataTableCell className="text-center">
          <Badge
            variant={isExists ? "outline" : "secondary"}
            className={
              isExists
                ? "border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                : undefined
            }>
            {isExists ? "Да" : "Нет"}
          </Badge>
        </DataTableCell>
      );
    },
  },
];
