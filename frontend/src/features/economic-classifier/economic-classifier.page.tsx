import type { ClassifierFormOutput } from "./classifier-form";

import { useCallback, useMemo, useState } from "react";

import { DataTable } from "@/shared/ui/data-table/data-table";

import { ClassifierForm } from "./classifier-form";
import { ClassifierToolbar } from "./classifier-toolbar";
import { createColumns } from "./columns";
import { useClassifierSearch } from "./use-classifier-search";

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EconomicClassifier | null>(
    null,
  );

  const { search, setSearch, filteredData } = useClassifierSearch(data);

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleEdit = useCallback((item: EconomicClassifier) => {
    setEditingItem(item);
    setDrawerOpen(true);
  }, []);

  const handleDelete = useCallback((id: number) => {
    setData((prev) => prev.filter((item) => item.id !== id));
  }, []);

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

    [handleEdit, handleDelete],
  );

  return (
    <div className="flex flex-col gap-4">
      <ClassifierToolbar
        search={search}
        onSearchChange={setSearch}
        onAdd={handleAdd}
      />

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
