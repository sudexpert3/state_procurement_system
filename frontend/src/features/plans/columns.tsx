import type { ColumnDef } from "@tanstack/react-table";
import type { Purchase } from "@/shared/api/schema";

import {
  DataTableCell,
  DataTableColumnHeader,
} from "@/shared/components/data-table/data-table-cell";
import { formatDate } from "@/shared/lib/helpers/format-date";

export const createColumns = (): ColumnDef<Purchase>[] => [
  {
    accessorKey: "id",
    header: () => <DataTableColumnHeader>ID</DataTableColumnHeader>,
    cell: ({ row }) => <DataTableCell>{row.getValue("id")}</DataTableCell>,
  },
  {
    accessorKey: "purchase_id",
    header: () => <DataTableColumnHeader>ID плана</DataTableColumnHeader>,
    cell: ({ row }) => (
      <DataTableCell>{row.getValue("purchase_id") ?? "—"}</DataTableCell>
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
    accessorKey: "company",
    header: () => (
      <DataTableColumnHeader>Наименование организации</DataTableColumnHeader>
    ),
    size: 280,
    cell: ({ row }) => (
      <DataTableCell className="text-left wrap-break-word whitespace-normal">
        {row.getValue("company")}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "ved",
    header: () => (
      <DataTableColumnHeader>
        Ведомственная принадлежность
      </DataTableColumnHeader>
    ),
    size: 220,
    cell: ({ row }) => (
      <DataTableCell className="text-left wrap-break-word whitespace-normal">
        {row.getValue("ved")}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "country",
    header: () => <DataTableColumnHeader>Страна</DataTableColumnHeader>,
    cell: ({ row }) => <DataTableCell>{row.getValue("country")}</DataTableCell>,
  },
  {
    accessorKey: "region",
    header: () => <DataTableColumnHeader>Область</DataTableColumnHeader>,
    cell: ({ row }) => (
      <DataTableCell>{row.getValue("region") ?? "—"}</DataTableCell>
    ),
  },
  {
    accessorKey: "city",
    header: () => <DataTableColumnHeader>Город</DataTableColumnHeader>,
    cell: ({ row }) => (
      <DataTableCell>{row.getValue("city") ?? "—"}</DataTableCell>
    ),
  },
  {
    accessorKey: "address",
    header: () => <DataTableColumnHeader>Адрес</DataTableColumnHeader>,
    size: 220,
    cell: ({ row }) => (
      <DataTableCell className="text-left wrap-break-word whitespace-normal">
        {row.getValue("address") ?? "—"}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "establishment",
    header: () => <DataTableColumnHeader>Ведомство</DataTableColumnHeader>,
    cell: ({ row }) => (
      <DataTableCell>{row.getValue("establishment") ?? "—"}</DataTableCell>
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
  {
    accessorKey: "date_edit",
    header: () => (
      <DataTableColumnHeader>Дата редактирования</DataTableColumnHeader>
    ),
    cell: ({ row }) => (
      <DataTableCell className="whitespace-nowrap">
        {formatDate(row.getValue("date_edit"))}
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
    accessorKey: "signer_descrip",
    header: () => (
      <DataTableColumnHeader>Лицо утвердившее план</DataTableColumnHeader>
    ),
    size: 200,
    cell: ({ row }) => (
      <DataTableCell className="text-left wrap-break-word whitespace-normal">
        {row.getValue("signer_descrip")}
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
      <DataTableCell className="text-left wrap-break-word whitespace-normal">
        {row.getValue("sender_descrip")}
      </DataTableCell>
    ),
  },
  {
    accessorKey: "year",
    header: () => <DataTableColumnHeader>Год плана</DataTableColumnHeader>,
    cell: ({ row }) => (
      <DataTableCell>{row.getValue("year") ?? "—"}</DataTableCell>
    ),
  },
  {
    accessorKey: "is_draft",
    header: () => <DataTableColumnHeader>Черновик</DataTableColumnHeader>,
    cell: ({ row }) => (
      <DataTableCell>{row.getValue("is_draft") ? "Да" : "Нет"}</DataTableCell>
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
];
