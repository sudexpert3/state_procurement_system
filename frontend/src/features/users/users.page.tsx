import type { User } from "@/shared/api/schema";

import { useCallback, useMemo, useState } from "react";

import { keepPreviousData } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
import { DataTable } from "@/shared/components/data-table/data-table";
import { useServerPagination } from "@/shared/components/data-table/hooks/use-server-pagination";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

import { useUserDelete } from "./hooks/use-user-delete";
import { createColumns } from "./columns";
import { UserForm } from "./user-form";

const UsersPage = () => {
  const { limit, offset, pagination, onPaginationChange } =
    useServerPagination();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<User | null>(null);

  const { data, isLoading } = rqClient.useQuery(
    "get",
    "/api/users/",
    { params: { query: { limit, offset } } },
    { placeholderData: keepPreviousData },
  );
  const buyersQuery = rqClient.useQuery("get", "/api/buyers/");
  const buyers = useMemo(() => buyersQuery.data ?? [], [buyersQuery.data]);
  const buyersById = useMemo(
    () => new Map(buyers.map((buyer) => [buyer.id, buyer])),
    [buyers],
  );

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["get", "/api/users/"] }),
    [],
  );

  const { handleDelete, deletingId } = useUserDelete(invalidate);

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleEdit = useCallback((item: User) => {
    setEditingItem(item);
    setDrawerOpen(true);
  }, []);

  const columns = useMemo(
    () => createColumns(handleEdit, handleDelete, buyersById, deletingId),
    [handleEdit, handleDelete, buyersById, deletingId],
  );

  return (
    <Card className="max-w-full flex-1 gap-2 bg-transparent ring-0">
      <CardHeader>
        <CardTitle>Пользователи</CardTitle>
        <CardDescription>
          Учётные записи и роли доступа (видно и редактируется только ролью
          «Главный администратор»)
        </CardDescription>
        <CardAction>
          <Button onClick={handleAdd}>
            <PlusIcon size={16} />
            Новый пользователь
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <DataTable
          data={data?.results ?? []}
          columns={columns}
          isLoading={isLoading}
          fillAvailableHeight
          pagination={{
            manual: {
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
              rowCount: data?.count ?? 0,
              onChange: onPaginationChange,
            },
          }}
        />
      </CardContent>

      <UserForm
        open={drawerOpen}
        item={editingItem}
        buyers={buyers}
        onClose={() => setDrawerOpen(false)}
        onSuccess={invalidate}
      />
    </Card>
  );
};

export const Component = UsersPage;
