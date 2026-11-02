import type { OkrbProduct } from "@/shared/api/schema";

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

import { useCodeOkrb } from "./hooks/use-code-okrb";
import { useCodeOkrbDelete } from "./hooks/use-code-okrb-delete";
import { CodeOkrbForm } from "./code-okrb-form";
import { CodeOkrbToolbar } from "./code-okrb-toolbar";
import { createColumns } from "./columns";

const CodeOkrbPage = () => {
  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    data,
    isLoading,
    invalidate,
  } = useCodeOkrb();

  const { handleDelete, deletingId } = useCodeOkrbDelete(invalidate);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OkrbProduct | null>(null);

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleEdit = useCallback((item: OkrbProduct) => {
    setEditingItem(item);
    setDrawerOpen(true);
  }, []);

  const columns = useMemo(
    () => createColumns(handleEdit, handleDelete, deletingId),
    [handleEdit, handleDelete, deletingId],
  );

  return (
    <Card className="max-w-full gap-2 bg-transparent ring-0">
      <CardHeader>
        <CardTitle>Коды ОКРБ</CardTitle>
        <CardDescription>Справочник кодов ОКРБ</CardDescription>
        <CardAction>
          <Button onClick={handleAdd}>
            <PlusIcon size={16} />
            Добавить
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <DataTable
          data={data}
          columns={columns}
          isLoading={isLoading}
          cellClassName=""
          actions={() => (
            <div className="py-4">
              <CodeOkrbToolbar
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />
            </div>
          )}
        />
      </CardContent>

      <CodeOkrbForm
        open={drawerOpen}
        item={editingItem}
        onClose={() => setDrawerOpen(false)}
        onSuccess={invalidate}
      />
    </Card>
  );
};

export const Component = CodeOkrbPage;
