import { SearchIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/shared/components/ui/input-group";

interface ClassifierToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
}

export function ClassifierToolbar({
  search,
  onSearchChange,
}: ClassifierToolbarProps) {
  return (
    <div className="flex items-center gap-4">
      <InputGroup className="max-w-sm bg-white">
        <InputGroupAddon>
          <SearchIcon size={16} />
        </InputGroupAddon>
        <InputGroupInput
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск по коду или названию"
        />
      </InputGroup>
    </div>
  );
}
