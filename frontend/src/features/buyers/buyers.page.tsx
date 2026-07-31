import type { Buyer } from "@/shared/api/schema";

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

import { useBuyerDelete } from "./model/use-buyer-delete";
import { useBuyers } from "./model/use-buyers";
import { useBuyersFilters } from "./model/use-buyers-filters";
import { BuyerDrawer } from "./buyer-drawer";
import { BuyersToolbar } from "./buyers-toolbar";
import { createColumns } from "./columns";

const BuyersPage = () => {
  const { filters, search, setSearch, statusFilter, setStatusFilter } =
    useBuyersFilters();
  const { data, isLoading } = useBuyers(filters);

  const deleteBuyer = useBuyerDelete();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Buyer | null>(null);

  const createBuyer = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const editBuyer = useCallback((item: Buyer) => {
    setEditingItem(item);
    setDrawerOpen(true);
  }, []);

  const columns = useMemo(
    () =>
      createColumns(
        editBuyer,
        deleteBuyer.deleteBuyer,
        deleteBuyer.getDeletingId,
      ),
    [editBuyer, deleteBuyer.deleteBuyer, deleteBuyer.getDeletingId],
  );

  return (
    <Card className="max-w-full gap-2 bg-transparent ring-0">
      <CardHeader>
        <CardTitle>Закупщики</CardTitle>
        <CardDescription>Список заказчиков</CardDescription>
        <CardAction>
          <Button onClick={createBuyer}>
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
              <BuyersToolbar
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />
            </div>
          )}
        />
      </CardContent>

      <BuyerDrawer
        open={drawerOpen}
        item={editingItem}
        onClose={() => setDrawerOpen(false)}
      />
    </Card>
  );
};

export const Component = BuyersPage;
