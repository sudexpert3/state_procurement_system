import type { ClassifierFormOutput } from "./classifier-form";

import { useMemo, useState } from "react";

import { PlusIcon, SearchIcon } from "lucide-react";

import { DataTable } from "@/shared/ui/data-table/data-table";
import { Button } from "@/shared/ui/kit/button";
import { Card, CardContent } from "@/shared/ui/kit/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/shared/ui/kit/input-group";

import { ClassifierForm } from "./classifier-form";
import { createColumns } from "./columns";

export type EconomicClassifier = {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
};

const INITIAL_DATA: EconomicClassifier[] = [
  { id: 1, code: "200", name: "Расходы", parent_id: null },
  { id: 2, code: "210", name: "Затраты на оплату труда", parent_id: 1 },
  { id: 3, code: "211", name: "Заработная плата", parent_id: 2 },
  {
    id: 4,
    code: "212",
    name: "Начисления на заработную плату",
    parent_id: 2,
  },
  { id: 5, code: "220", name: "Коммунальные услуги", parent_id: 1 },
  { id: 6, code: "221", name: "Отопление", parent_id: 5 },
  { id: 7, code: "222", name: "Электроэнергия", parent_id: 5 },
  { id: 8, code: "300", name: "Капитальные вложения", parent_id: null },
  { id: 9, code: "310", name: "Строительство", parent_id: 8 },
  {
    id: 10,
    code: "320",
    name: "Приобретение основных средств",
    parent_id: 8,
  },
];

let nextId = INITIAL_DATA.length + 1;

const EconomicClassifierPage = () => {
  const [data, setData] = useState<EconomicClassifier[]>(INITIAL_DATA);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EconomicClassifier | null>(
    null,
  );

  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (item) =>
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q),
    );
  }, [data, search]);

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleEdit = (item: EconomicClassifier) => {
    setEditingItem(item);
    setDrawerOpen(true);
  };

  const handleDelete = (id: number) => {
    setData((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = (values: ClassifierFormOutput, id?: number) => {
    if (id !== undefined) {
      setData((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...values } : item)),
      );
    } else {
      setData((prev) => [...prev, { id: nextId++, ...values }]);
    }
  };

  const columns = useMemo(
    () => createColumns(handleEdit, handleDelete),

    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex items-center gap-4">
          <InputGroup className="max-w-sm">
            <InputGroupAddon>
              <SearchIcon size={16} />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по коду или названию"
            />
          </InputGroup>
          <Button onClick={handleAdd}>
            <PlusIcon size={16} />
            Добавить
          </Button>
        </CardContent>
      </Card>

      <DataTable data={filteredData} columns={columns} enableActions={false} />

      <ClassifierForm
        open={drawerOpen}
        item={editingItem}
        allItems={data}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export const Component = EconomicClassifierPage;
