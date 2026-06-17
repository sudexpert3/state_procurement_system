import type { BuyerFormOutput, BuyerItem } from "./buyer-form";

import { useMemo, useState } from "react";

import { PlusIcon, SearchIcon } from "lucide-react";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
import { DataTable } from "@/shared/ui/data-table/data-table";
import { Button } from "@/shared/ui/kit/button";
import { Card, CardContent } from "@/shared/ui/kit/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/ui/kit/combobox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/shared/ui/kit/input-group";

import { BuyerForm } from "./buyer-form";
import { createColumns } from "./columns";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "true", label: "Действующие" },
  { value: "false", label: "Не действующие" },
];

const BuyersPage = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BuyerItem | null>(null);

  const { data: buyers = [] } = rqClient.useQuery("get", "/api/buyers/");

  const createMutation = rqClient.useMutation("post", "/api/buyers/");
  const updateMutation = rqClient.useMutation("put", "/api/buyers/{id}/");
  const deleteMutation = rqClient.useMutation("delete", "/api/buyers/{id}/");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["get", "/api/buyers/"] });

  const filteredData = useMemo(() => {
    let result = buyers as BuyerItem[];
    if (statusFilter !== "all") {
      const isActive = statusFilter === "true";
      result = result.filter((item) => item.is_active === isActive);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.shot_name.toLowerCase().includes(q) ||
          item.full_name.toLowerCase().includes(q),
      );
    }
    return result;
  }, [buyers, search, statusFilter]);

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleEdit = (item: BuyerItem) => {
    setEditingItem(item);
    setDrawerOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { params: { path: { id } } },
      { onSuccess: invalidate },
    );
  };

  const handleSubmit = (values: BuyerFormOutput, id?: number) => {
    if (id !== undefined) {
      updateMutation.mutate(
        { params: { path: { id } }, body: values },
        { onSuccess: invalidate },
      );
    } else {
      createMutation.mutate({ body: values }, { onSuccess: invalidate });
    }
  };

  const columns = useMemo(
    () => createColumns(handleEdit, handleDelete),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              placeholder="Поиск по имени"
            />
          </InputGroup>
          <Combobox
            value={
              STATUS_FILTER_OPTIONS.find((opt) => opt.value === statusFilter)
                ?.label
            }
            onValueChange={(item) => {
              setStatusFilter(item?.value);
            }}>
            <ComboboxInput
              placeholder="Статус..."
              showClear={false}
              className="w-48"
            />
            <ComboboxContent>
              <ComboboxList>
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <ComboboxItem key={opt.value} value={opt}>
                    {opt.label}
                  </ComboboxItem>
                ))}
                <ComboboxEmpty>Ничего не найдено</ComboboxEmpty>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <Button onClick={handleAdd}>
            <PlusIcon size={16} />
            Добавить
          </Button>
        </CardContent>
      </Card>

      <DataTable data={filteredData} columns={columns} enableActions={false} />

      <BuyerForm
        open={drawerOpen}
        item={editingItem}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export const Component = BuyersPage;
