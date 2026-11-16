import type { ColumnDef } from "@tanstack/react-table";
import type { Buyer, User } from "@/shared/api/schema";

import { PencilIcon } from "lucide-react";

import { DataTableCell } from "@/shared/components/data-table/data-table-cell";
import { DeleteButton } from "@/shared/components/delete-button";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

export const createColumns = (
  onEdit: (item: User) => void,
  onDelete: (id: number) => void,
  buyersById: Map<number, Buyer>,
  deletingId?: number | null,
): ColumnDef<User>[] => [
  {
    id: "actions",
    size: 50,
    cell: ({ row }) => (
      <DataTableCell>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(row.original)}>
          <PencilIcon size={16} className="text-muted-foreground" />
        </Button>
        <DeleteButton
          onConfirm={() => onDelete(row.original.id)}
          isPending={deletingId === row.original.id}
          description="Учётная запись будет удалена безвозвратно. Чтобы просто заблокировать вход, снимите флаг «Активен» в редактировании."
        />
      </DataTableCell>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "username",
    header: "Логин",
    cell: ({ getValue }) => (
      <DataTableCell className="text-left font-medium">
        {getValue<string>()}
      </DataTableCell>
    ),
  },
  {
    id: "full_name",
    header: "ФИО",
    cell: ({ row }) => {
      const name = [row.original.last_name, row.original.first_name]
        .filter(Boolean)
        .join(" ");
      return <DataTableCell className="text-left">{name || "—"}</DataTableCell>;
    },
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ getValue }) => (
      <DataTableCell>{getValue<string>() || "—"}</DataTableCell>
    ),
  },
  {
    accessorKey: "role_display",
    header: "Роль",
    cell: ({ getValue }) => (
      <Badge variant="secondary">{getValue<string>()}</Badge>
    ),
  },
  {
    id: "buyer",
    header: "Закупщик",
    cell: ({ row }) => {
      const buyer = row.original.buyer
        ? buyersById.get(row.original.buyer)
        : null;
      return <DataTableCell>{buyer?.shot_name ?? "—"}</DataTableCell>;
    },
  },
  {
    accessorKey: "is_active",
    header: "Статус",
    cell: ({ getValue }) =>
      getValue<boolean>() ? (
        <Badge variant="outline">Активен</Badge>
      ) : (
        <Badge variant="destructive">Заблокирован</Badge>
      ),
  },
];
