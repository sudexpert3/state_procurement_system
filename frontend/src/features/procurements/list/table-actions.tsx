import type { Table } from "@tanstack/react-table";

import { SearchIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/shared/ui/kit/input-group";

import { ColumnVisibilityDropdown } from "./column-visibility-dropdown";

type TableActionsProps<TData> = { table: Table<TData> };

export const TableActions = <TData,>({ table }: TableActionsProps<TData>) => {
  const searchText =
    (table.getState().globalFilter as string | undefined) ?? "";

  return (
    <div className="flex items-center gap-2 px-0">
      <InputGroup className="max-w-sm bg-white">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          value={searchText}
          onChange={(e) => table.setGlobalFilter(e.target.value)}
          placeholder="Поиск"
        />
      </InputGroup>
      <ColumnVisibilityDropdown table={table} />
    </div>
  );
};
