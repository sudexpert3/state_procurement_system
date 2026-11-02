import type { Department } from "@/shared/api/schema";

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

import { DepartmentForm } from "./form/department-form";
import { useDepartmentDelete } from "./hooks/use-department-delete";
import { useDepartments } from "./hooks/use-departments";
import { createColumns } from "./columns";
import { DepartmentsToolbar } from "./departments-toolbar";

const DepartmentsPage = () => {
  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    data,
    flatData,
    isLoading,
    invalidate,
  } = useDepartments();

  const { handleDelete, deletingId } = useDepartmentDelete(invalidate);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Department | null>(null);

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleEdit = useCallback((item: Department) => {
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
        <CardTitle>Подразделения</CardTitle>
        <CardDescription>
          Иерархический справочник подразделений
        </CardDescription>
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
          getSubRows={(row) => row.sub_departments}
          globalFilter={search}
          forceExpanded={search.trim().length > 0}
          actions={() => (
            <div className="py-4">
              <DepartmentsToolbar
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />
            </div>
          )}
        />
      </CardContent>

      <DepartmentForm
        open={drawerOpen}
        item={editingItem}
        allItems={flatData}
        onClose={() => setDrawerOpen(false)}
        onSuccess={invalidate}
      />
    </Card>
  );
};

export const Component = DepartmentsPage;
