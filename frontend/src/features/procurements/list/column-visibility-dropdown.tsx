import type { Table } from "@tanstack/react-table";

import { useState } from "react";

import {
  ChevronDownIcon,
  Columns3Icon,
  RefreshCcwIcon,
  SearchIcon,
} from "lucide-react";

import { Button } from "@/shared/ui/kit/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/kit/dropdown-menu";
import { Input } from "@/shared/ui/kit/input";

type Props<TData> = { table: Table<TData> };

const getColumnLabel = (column: {
  id: string;
  columnDef: { header?: unknown };
}) => {
  console.log(column);
  const header = column.columnDef.header;
  return typeof header === "string" ? header : column.id;
};

export const ColumnVisibilityDropdown = <TData,>({ table }: Props<TData>) => {
  const [searchQuery, setSearchQuery] = useState("");

  const columns = table.getAllColumns().filter((col) => col.getCanHide());

  const visibleColumns = searchQuery
    ? columns.filter((col) =>
        getColumnLabel(col).toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : columns;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full max-w-3xs justify-between">
          <span className="flex items-center gap-2">
            <Columns3Icon />
            Вид колонок
          </span>
          <ChevronDownIcon className="ml-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="relative">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
            placeholder="Поиск колонок"
            onKeyDown={(e) => e.stopPropagation()}
          />
          <SearchIcon className="absolute inset-y-0 left-2 my-auto size-4" />
        </div>
        <DropdownMenuSeparator />
        {visibleColumns.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.id}
            checked={col.getIsVisible()}
            onCheckedChange={(value) => col.toggleVisibility(!!value)}
            onSelect={(e) => e.preventDefault()}>
            {getColumnLabel(col)}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            table.resetColumnVisibility();
            setSearchQuery("");
          }}>
          <RefreshCcwIcon /> Сбросить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
