import type { InternalEconomicCode } from "@/shared/api/schema";

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

import { useInternalEconomicCode } from "./hooks/use-internal-economic-code";
import { useInternalEconomicCodeDelete } from "./hooks/use-internal-economic-code-delete";
import { createColumns } from "./columns";
import { InternalEconomicCodeForm } from "./internal-economic-code-form";
import { InternalEconomicCodeToolbar } from "./internal-economic-code-toolbar";

const InternalEconomicCodePage = () => {
  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    data,
    isLoading,
    invalidate,
  } = useInternalEconomicCode();

  const { handleDelete, deletingId } =
    useInternalEconomicCodeDelete(invalidate);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InternalEconomicCode | null>(
    null,
  );

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleEdit = useCallback((item: InternalEconomicCode) => {
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
        <CardTitle>Внутренние коды ЭКР</CardTitle>
        <CardDescription>
          Справочник внутренних кодов экономической классификации расходов
          (ГКСЭ)
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
          cellClassName=""
          actions={() => (
            <div className="py-4">
              <InternalEconomicCodeToolbar
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />
            </div>
          )}
        />
      </CardContent>

      <InternalEconomicCodeForm
        open={drawerOpen}
        item={editingItem}
        allItems={data}
        onClose={() => setDrawerOpen(false)}
        onSuccess={invalidate}
      />
    </Card>
  );
};

export const Component = InternalEconomicCodePage;
