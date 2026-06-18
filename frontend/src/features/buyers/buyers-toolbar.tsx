import { PlusIcon, SearchIcon } from "lucide-react";

import { Button } from "@/shared/ui/kit/button";
import { Card, CardContent } from "@/shared/ui/kit/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/shared/ui/kit/input-group";

import { BuyersFilter } from "./buyers-filter";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onAdd: () => void;
};

export const BuyersToolbar = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onAdd,
}: Props) => (
  <Card>
    <CardContent className="flex items-center gap-4">
      <InputGroup className="max-w-sm">
        <InputGroupAddon>
          <SearchIcon size={16} />
        </InputGroupAddon>
        <InputGroupInput
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск по имени"
        />
      </InputGroup>
      <BuyersFilter value={statusFilter} onValueChange={onStatusFilterChange} />
      <Button onClick={onAdd}>
        <PlusIcon size={16} />
        Добавить
      </Button>
    </CardContent>
  </Card>
);
