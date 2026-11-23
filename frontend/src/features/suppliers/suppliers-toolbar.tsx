import { SearchIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/shared/components/ui/input-group";

import { SuppliersFilter, type UnpFilterValue } from "./suppliers-filter";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  unpFilter: UnpFilterValue;
  onUnpFilterChange: (value: UnpFilterValue) => void;
};

export const SuppliersToolbar = ({
  search,
  onSearchChange,
  unpFilter,
  onUnpFilterChange,
}: Props) => (
  <div className="flex items-center gap-4">
    <InputGroup className="max-w-sm bg-white">
      <InputGroupAddon>
        <SearchIcon size={16} />
      </InputGroupAddon>
      <InputGroupInput
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Поиск по наименованию или УНП"
      />
    </InputGroup>
    <SuppliersFilter value={unpFilter} onValueChange={onUnpFilterChange} />
  </div>
);
