import type { Table } from "@tanstack/react-table";

import { SearchIcon } from "lucide-react";

import { ColumnVisibilityDropdown } from "@/shared/components/data-table/column-visibility-dropdown";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/shared/components/ui/input-group";

type TableActionsProps<TData> = { table: Table<TData> };

export const TableActions = <TData,>({ table }: TableActionsProps<TData>) => {
  const searchText =
    (table.getState().globalFilter as string | undefined) ?? "";

  return (
    <div className="flex items-center gap-2 px-0">
      <InputGroup className="w-[21rem] bg-white">
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
