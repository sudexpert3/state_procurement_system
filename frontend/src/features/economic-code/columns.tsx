import type { ColumnDef } from "@tanstack/react-table";
import type { EconomicCode } from "@/shared/api/schema";

import { ArrowUpDownIcon, PencilIcon } from "lucide-react";

import { DataTableCell } from "@/shared/components/data-table/data-table-cell";
import { DeleteButton } from "@/shared/components/delete-button";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

// Исторически `description` у части записей (импорт) дублирует код той же
// строки через точку впереди текста ("1.10.06.00 Оплата услуг связи") —
// раньше здесь слепо отрезался первый "токен" по пробелу, что ломалось на
// описаниях без такого префикса (например, введённых вручную без кода:
// "Капитальное строительство" теряло слово "Капитальное"). Срезаем префикс,
// только если он РОВНО совпадает с кодом этой же строки в точечном формате —
// иначе показываем описание как есть, ничего не теряя.
const stripRedundantCodePrefix = (description: string, codeApi: string) => {
  const dottedCode = codeApi.trim().split(/\s+/).join(".");
  const [firstToken, ...rest] = description.split(" ");
  return firstToken === dottedCode ? rest.join(" ") : description;
};

export const createColumns = (
  onEdit: (item: EconomicCode) => void,
  onDelete: (id: number) => void,
  deletingId?: number | null,
): ColumnDef<EconomicCode>[] => [
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
        />
      </DataTableCell>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "code_api",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={column.getToggleSortingHandler()}>
        Код <ArrowUpDownIcon size={14} className="ml-1" />
      </Button>
    ),
    size: 30,
    cell: ({ getValue }) => <DataTableCell>{getValue<string>()}</DataTableCell>,
  },
  {
    accessorKey: "description",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="p-0"
        onClick={column.getToggleSortingHandler()}>
        Наименование <ArrowUpDownIcon size={14} className="ml-1" />
      </Button>
    ),
    cell: ({ row, getValue }) => {
      const description = stripRedundantCodePrefix(
        getValue<string>(),
        row.original.code_api,
      );
      // Решение пользователя (2026-11-19): та же подсветка "Новый код из
      // API:", что уже есть у функциональных/программных кодов — ещё не
      // выверенная вручную запись после синхронизации с goszakupki.by.
      const isUnverified = description.includes("Новый код из API:");

      return (
        <DataTableCell className="wrap-break-word whitespace-normal">
          {isUnverified ? (
            <Badge variant="destructive" className="text-sm">
              {description}
            </Badge>
          ) : (
            description
          )}
        </DataTableCell>
      );
    },
  },
  {
    accessorKey: "is_active",
    header: "Статус",
    cell: ({ row }) => (
      <DataTableCell>
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? "Действующий" : "Не действующий"}
        </Badge>
      </DataTableCell>
    ),
  },
];
