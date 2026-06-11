import { useState } from "react";

import { SearchIcon } from "lucide-react";
import { useNavigate } from "react-router";

import { ROUTES } from "@/shared/model/routes";
import { Button } from "@/shared/ui/kit/button";
import { Card, CardContent } from "@/shared/ui/kit/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/shared/ui/kit/input-group";

export const TableActions = () => {
  const [searchText, setSearchText] = useState<string>("");
  const navigate = useNavigate();

  const handleAddProcurement = () => {
    navigate(ROUTES.PROCUREMENT_ADD);
  };

  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <InputGroup className="max-w-sm">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Поиск"
          />
        </InputGroup>
        {/* <input type="file" accept=".xlsx, .csv" />
        <Button>Обновить финансы</Button>*/}
        <Button onClick={handleAddProcurement}>Добавить запись</Button>
      </CardContent>
    </Card>
  );
};
