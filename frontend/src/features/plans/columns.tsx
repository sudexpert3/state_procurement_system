import type { ColumnDef } from "@tanstack/react-table";
import type { Purchase } from "@/shared/api/schema";

import { cn } from "@siberiacancode/reactuse";

import {
  DataTableCell,
  DataTableColumnHeader,
} from "@/shared/components/data-table/data-table-cell";
import { formatDate } from "@/shared/lib/helpers/format-date";

export const createColumns = (): ColumnDef<Purchase>[] => [
  {
    accessorKey: "year",
    header: () => <DataTableColumnHeader>Год плана</DataTableColumnHeader>,
    cell: ({ row }) => (
      <DataTableCell>{row.getValue("year") ?? "—"}</DataTableCell>
    ),
  },
  {
    accessorKey: "purchase_num",
    header: () => (
      <DataTableColumnHeader>Рег. номер плана</DataTableColumnHeader>
    ),
    size: 120,
    cell: ({ row }) => (
      <DataTableCell className="font-medium">
        {row.getValue("purchase_num") ?? "—"}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "is_draft",
    header: () => <DataTableColumnHeader>Черновик</DataTableColumnHeader>,
    cell: ({ row }) => (
      <DataTableCell
        className={cn(`${row.getValue("is_draft") && "bg-red-200 uppercase"}`)}>
        {row.getValue("is_draft") ? "Да" : "Нет"}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "at_updated",
    header: () => (
      <DataTableColumnHeader>Дата последнего изменения</DataTableColumnHeader>
    ),
    cell: ({ row }) => (
      <DataTableCell className="whitespace-nowrap">
        {formatDate(row.getValue("at_updated"))}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "signer_descrip",
    header: () => (
      <DataTableColumnHeader>Лицо утвердившее план</DataTableColumnHeader>
    ),
    size: 200,
    cell: ({ row }) => (
      <DataTableCell className="wrap-break-word whitespace-normal">
        {row.getValue("signer_descrip")}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "date_sign",
    header: () => (
      <DataTableColumnHeader>Дата утверждения</DataTableColumnHeader>
    ),
    cell: ({ row }) => (
      <DataTableCell className="whitespace-nowrap">
        {formatDate(row.getValue("date_sign"))}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "sender_descrip",
    header: () => (
      <DataTableColumnHeader>Лицо разместившее план</DataTableColumnHeader>
    ),
    size: 200,
    cell: ({ row }) => (
      <DataTableCell className="wrap-break-word whitespace-normal">
        {row.getValue("sender_descrip")}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "date_added",
    header: () => (
      <DataTableColumnHeader>Дата добавления</DataTableColumnHeader>
    ),
    cell: ({ row }) => (
      <DataTableCell className="whitespace-nowrap">
        {formatDate(row.getValue("date_added"))}
      </DataTableCell>
    ),
  },
];
