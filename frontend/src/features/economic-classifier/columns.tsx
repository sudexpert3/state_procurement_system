import type { ColumnDef } from "@tanstack/react-table";
import type { EconomicClassifier } from "./economic-classifier.page";

import { ArrowUpDownIcon, PencilIcon } from "lucide-react";

import { DeleteButton } from "@/shared/ui/delete-button";
import { Button } from "@/shared/ui/kit/button";

export const createColumns = (
  onEdit: (item: EconomicClassifier) => void,
  onDelete: (id: number) => void,
): ColumnDef<EconomicClassifier>[] => [
  {
    id: "actions",
    cell: ({ row }) => (
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(row.original)}>
          <PencilIcon size={16} className="text-muted-foreground" />
        </Button>
        <DeleteButton onConfirm={() => onDelete(row.original.id)} />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "code",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={column.getToggleSortingHandler()}>
        Код <ArrowUpDownIcon size={14} className="ml-1" />
      </Button>
    ),
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={column.getToggleSortingHandler()}>
        Наименование <ArrowUpDownIcon size={14} className="ml-1" />
      </Button>
    ),
  },
  {
    accessorKey: "parent_id",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={column.getToggleSortingHandler()}>
        Родитель (ID) <ArrowUpDownIcon size={14} className="ml-1" />
      </Button>
    ),
    cell: ({ row }) => row.original.parent_id ?? "—",
  },
];
