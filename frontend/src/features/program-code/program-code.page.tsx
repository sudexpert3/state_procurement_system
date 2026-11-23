import type { ProgramCode } from "@/shared/api/schema";

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

import { useProgramCode } from "./hooks/use-program-code";
import { useProgramCodeDelete } from "./hooks/use-program-code-delete";
import { createColumns } from "./columns";
import { ProgramCodeForm } from "./program-code-form";
import { ProgramCodeToolbar } from "./program-code-toolbar";

const ProgramCodePage = () => {
  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    data,
    isLoading,
    invalidate,
  } = useProgramCode();

  const { handleDelete, deletingId } = useProgramCodeDelete(invalidate);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProgramCode | null>(null);

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleEdit = useCallback((item: ProgramCode) => {
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
        <CardTitle>Программные коды</CardTitle>
        <CardDescription>Программная классификация расходов</CardDescription>
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
              <ProgramCodeToolbar
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />
            </div>
          )}
        />
      </CardContent>

      <ProgramCodeForm
        open={drawerOpen}
        item={editingItem}
        onClose={() => setDrawerOpen(false)}
        onSuccess={invalidate}
      />
    </Card>
  );
};

export const Component = ProgramCodePage;
