import type { Contract } from "@/shared/api/schema";

import { useMemo, useState } from "react";

import { keepPreviousData } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";

import { useCurrentUser } from "@/services/auth";
import { rqClient } from "@/shared/api/instance";
import { DataTable } from "@/shared/components/data-table/data-table";
import { useServerPagination } from "@/shared/components/data-table/hooks/use-server-pagination";
import { useServerSearch } from "@/shared/components/data-table/hooks/use-server-search";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { cn } from "@/shared/lib/utils";

import { createColumns } from "./columns";
import { ContractDetail } from "./contract-detail";
import { ContractForm } from "./contract-form";
import {
  ContractsToolbar,
  type ExpiringWithinDaysFilterValue,
  type HasPaymentsFilterValue,
} from "./contracts-toolbar";

const ContractsPage = () => {
  const { limit, offset, pagination, onPaginationChange } =
    useServerPagination();
  const { search, debouncedSearch, setSearch } = useServerSearch();
  const [hasPaymentsFilter, setHasPaymentsFilter] =
    useState<HasPaymentsFilterValue>("all");
  const [expiringFilter, setExpiringFilter] =
    useState<ExpiringWithinDaysFilterValue>("all");
  const [selected, setSelected] = useState<Contract | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Редактирование/создание записи договора — доступно только этим двум
  // ролям (capability edit_contracts на бэке, см. core/choices.py и
  // CurrentStatus.md). Тот же принцип проверки, что и в info-tab.tsx/
  // contract-detail-body.tsx.
  const { data: currentUser } = useCurrentUser();
  const canEdit =
    currentUser?.role === "ADMIN_MAIN" || currentUser?.role === "FINANCIER";

  const { data, isLoading } = rqClient.useQuery(
    "get",
    "/api/contracts/",
    {
      params: {
        query: {
          limit,
          offset,
          search: debouncedSearch || undefined,
          has_payments:
            hasPaymentsFilter === "all"
              ? undefined
              : hasPaymentsFilter === "true",
          expiring_within_days:
            expiringFilter === "all" ? undefined : Number(expiringFilter),
        },
      },
    },
    { placeholderData: keepPreviousData },
  );

  const columns = useMemo(() => createColumns(setSelected), []);

  return (
    <Card className="max-w-full flex-1 gap-2 bg-transparent ring-0">
      <CardHeader>
        <CardTitle>Реестр договоров</CardTitle>
        <CardDescription>
          Казначейский контроль исполнения договоров ГКСЭ
        </CardDescription>
        {canEdit && (
          <CardAction>
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon size={16} />
              Добавить договор
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <DataTable
          data={data?.results ?? []}
          columns={columns}
          isLoading={isLoading}
          cellClassName=""
          getRow={setSelected}
          fillAvailableHeight
          actions={() => (
            <div className="py-4">
              <ContractsToolbar
                search={search}
                onSearchChange={setSearch}
                hasPaymentsFilter={hasPaymentsFilter}
                onHasPaymentsFilterChange={setHasPaymentsFilter}
                expiringFilter={expiringFilter}
                onExpiringFilterChange={setExpiringFilter}
              />
            </div>
          )}
          pagination={{
            type: "default",
            manual: {
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
              rowCount: data?.count ?? 0,
              onChange: onPaginationChange,
            },
          }}
        />
      </CardContent>

      <ContractDetail
        item={selected}
        canEdit={canEdit}
        onClose={() => setSelected(null)}
        onUpdated={setSelected}
      />

      <Drawer open={createOpen} onOpenChange={setCreateOpen} direction="right">
        <DrawerContent
          className={cn(
            "flex flex-col",
            "data-[vaul-drawer-direction=right]:w-[calc(100%-50px)]",
            "data-[vaul-drawer-direction=right]:sm:max-w-[calc(100%-50px)]",
          )}>
          <DrawerHeader>
            <DrawerTitle>Новый договор</DrawerTitle>
          </DrawerHeader>
          <ContractForm
            item={null}
            onCancel={() => setCreateOpen(false)}
            onSuccess={() => setCreateOpen(false)}
          />
        </DrawerContent>
      </Drawer>
    </Card>
  );
};

export const Component = ContractsPage;
