import type { StatusFilterValue } from "@/shared/model/status";

import { SearchIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/shared/components/ui/input-group";

import { CodeOkrbFilter } from "./code-okrb-filter";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilterValue;
  onStatusFilterChange: (value: StatusFilterValue) => void;
};

export const CodeOkrbToolbar = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: Props) => (
  <div className="flex items-center gap-4">
    <InputGroup className="max-w-sm bg-white">
      <InputGroupAddon>
        <SearchIcon size={16} />
      </InputGroupAddon>
      <InputGroupInput
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Поиск по коду или наименованию"
      />
    </InputGroup>
    <CodeOkrbFilter value={statusFilter} onValueChange={onStatusFilterChange} />
  </div>
);
