import type { Supplier } from "@/shared/api/schema";

import { useCallback, useMemo, useState } from "react";

import { PlusIcon } from "lucide-react";

import { DataTable } from "@/shared/ui/data-table/data-table";
import { Button } from "@/shared/ui/kit/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/kit/card";

import { createColumns } from "./columns";
import { SupplierForm } from "./supplier-form";
import { SuppliersToolbar } from "./suppliers-toolbar";
import { useSupplierDelete } from "./use-supplier-delete";
import { useSuppliers } from "./use-suppliers";

const SuppliersPage = () => {
  const { search, setSearch, data, isLoading, invalidate } = useSuppliers();

  const { handleDelete, deletingId } = useSupplierDelete(invalidate);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleEdit = useCallback((item: Supplier) => {
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
        <CardTitle>Поставщики</CardTitle>
        <CardDescription>Справочник контрагентов</CardDescription>
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
          actions={() => (
            <div className="py-4">
              <SuppliersToolbar search={search} onSearchChange={setSearch} />
            </div>
          )}
        />
      </CardContent>

      <SupplierForm
        open={drawerOpen}
        item={editingItem}
        onClose={() => setDrawerOpen(false)}
        onSuccess={invalidate}
      />
    </Card>
  );
};

export const Component = SuppliersPage;
