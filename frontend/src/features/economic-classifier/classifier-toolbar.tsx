import { PlusIcon, SearchIcon } from "lucide-react";

import { Button } from "@/shared/ui/kit/button";
import { Card, CardContent } from "@/shared/ui/kit/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/shared/ui/kit/input-group";

interface ClassifierToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  onAdd: () => void;
}

export function ClassifierToolbar({
  search,
  onSearchChange,
  onAdd,
}: ClassifierToolbarProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <InputGroup className="max-w-sm">
          <InputGroupAddon>
            <SearchIcon size={16} />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Поиск по коду или названию"
          />
        </InputGroup>
        <Button onClick={onAdd}>
          <PlusIcon size={16} />
          Добавить
        </Button>
      </CardContent>
    </Card>
  );
}
