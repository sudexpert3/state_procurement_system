import type { UnitOfMeasurement } from "@/shared/api/schema";

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

import { useUnitsOfMeasurement } from "./hooks/use-units-of-measurement";
import { useUnitsOfMeasurementDelete } from "./hooks/use-units-of-measurement-delete";
import { createColumns } from "./columns";
import { UnitOfMeasurementForm } from "./units-of-measurement-form";
import { UnitOfMeasurementToolbar } from "./units-of-measurement-toolbar";

const UnitsOfMeasurementPage = () => {
  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    data,
    isLoading,
    invalidate,
  } = useUnitsOfMeasurement();

  const { handleDelete, deletingId } = useUnitsOfMeasurementDelete(invalidate);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UnitOfMeasurement | null>(
    null,
  );

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleEdit = useCallback((item: UnitOfMeasurement) => {
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
        <CardTitle>Единицы измерения</CardTitle>
        <CardDescription>
          Справочник единиц измерения ОКРБ 008-95
        </CardDescription>
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
              <UnitOfMeasurementToolbar
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />
            </div>
          )}
        />
      </CardContent>

      <UnitOfMeasurementForm
        open={drawerOpen}
        item={editingItem}
        onClose={() => setDrawerOpen(false)}
        onSuccess={invalidate}
      />
    </Card>
  );
};

export const Component = UnitsOfMeasurementPage;
