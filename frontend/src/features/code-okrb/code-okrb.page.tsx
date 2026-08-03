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

import { useCodeOkrb } from "./model/use-code-okrb";
import { useCodeOkrbDelete } from "./model/use-code-okrb-delete";
import { useCodeOkrbFilters } from "./model/use-code-okrb-filters";
import { CodeOkrbDrawer } from "./code-okrb-drawer";
import { CodeOkrbToolbar } from "./code-okrb-toolbar";
import { createColumns } from "./columns";

const CodeOkrbPage = () => {
  const { filters, search, setSearch, statusFilter, setStatusFilter } =
    useCodeOkrbFilters();
  const { data, isLoading, isError, refetch } = useCodeOkrb(filters);
  const deleteCodeOkrb = useCodeOkrbDelete();

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
    () =>
      createColumns(
        handleEdit,
        deleteCodeOkrb.deleteCodeOkrb,
        deleteCodeOkrb.getDeletingId,
      ),
    [handleEdit, deleteCodeOkrb.deleteCodeOkrb, deleteCodeOkrb.getDeletingId],
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
        {isError ? (
          <div
            role="alert"
            className="flex min-h-48 flex-col items-center justify-center gap-4">
            <p>Не удалось загрузить коды ОКРБ</p>
            <Button variant="outline" onClick={() => void refetch()}>
              Повторить
            </Button>
          </div>
        ) : (
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
        )}
      </CardContent>

      <CodeOkrbDrawer
        open={drawerOpen}
        item={editingItem}
        onClose={() => setDrawerOpen(false)}
      />
    </Card>
  );
};

export const Component = CodeOkrbPage;
