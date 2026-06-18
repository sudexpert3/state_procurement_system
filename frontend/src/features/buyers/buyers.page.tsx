import type { Buyer } from "@/shared/api/schema";

import { useCallback, useMemo, useState } from "react";

import { DataTable } from "@/shared/ui/data-table/data-table";

import { BuyerForm } from "./buyer-form";
import { BuyersToolbar } from "./buyers-toolbar";
import { createColumns } from "./columns";
import { useBuyerDelete } from "./use-buyer-delete";
import { useBuyers } from "./use-buyers";

const BuyersPage = () => {
  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    data,
    isLoading,
    invalidate,
  } = useBuyers();

  const { handleDelete, deletingId } = useBuyerDelete(invalidate);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Buyer | null>(null);

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleEdit = useCallback((item: Buyer) => {
    setEditingItem(item);
    setDrawerOpen(true);
  }, []);

  const columns = useMemo(
    () => createColumns(handleEdit, handleDelete, deletingId),
    [handleEdit, handleDelete, deletingId],
  );

  return (
    <div className="flex flex-col gap-4">
      <BuyersToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onAdd={handleAdd}
      />

      <DataTable
        data={data}
        columns={columns}
        enableActions={false}
        isLoading={isLoading}
      />

      <BuyerForm
        open={drawerOpen}
        item={editingItem}
        onClose={() => setDrawerOpen(false)}
        onSuccess={invalidate}
      />
    </div>
  );
};

export const Component = BuyersPage;
