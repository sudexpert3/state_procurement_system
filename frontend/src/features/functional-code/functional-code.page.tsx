import type { FunctionalCode } from "@/shared/api/schema";

import { useCallback, useMemo, useState } from "react";

import { PlusIcon } from "lucide-react";

import { DataTable } from "@/shared/components/data-table/data-table";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

import { useFunctionalCode } from "./hooks/use-functional-code";
import { useFunctionalCodeDelete } from "./hooks/use-functional-code-delete";
import { createColumns } from "./columns";
import { FunctionalCodeForm } from "./functional-code-form";
import { FunctionalCodeToolbar } from "./functional-code-toolbar";

const FunctionalCodePage = () => {
  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    data,
    isLoading,
    invalidate,
  } = useFunctionalCode();

  const { handleDelete, deletingId } = useFunctionalCodeDelete(invalidate);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FunctionalCode | null>(null);

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleEdit = useCallback((item: FunctionalCode) => {
    setEditingItem(item);
    setDrawerOpen(true);
  }, []);

  const columns = useMemo(
    () => createColumns(handleEdit, handleDelete, deletingId),
    [handleEdit, handleDelete, deletingId],
  );

  return (
    <Card className="max-w-full flex-1 gap-2 bg-transparent ring-0">
      <CardHeader>
        <CardTitle>Функциональные коды</CardTitle>
        <CardDescription>Функциональная классификация расходов</CardDescription>
        <CardAction>
          <Button onClick={handleAdd}>
            <PlusIcon size={16} />
            Добавить
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <DataTable
          data={data}
          columns={columns}
          isLoading={isLoading}
          cellClassName=""
          fillAvailableHeight
          actions={() => (
            <div className="py-4">
              <FunctionalCodeToolbar
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />
            </div>
          )}
        />
      </CardContent>

      <FunctionalCodeForm
        open={drawerOpen}
        item={editingItem}
        onClose={() => setDrawerOpen(false)}
        onSuccess={invalidate}
      />
    </Card>
  );
};

export const Component = FunctionalCodePage;
