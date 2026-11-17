import type { Purchase } from "@/shared/api/schema";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Loader2Icon } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import {
  useSyncAllPurchases,
  useSyncPurchaseItemsAction,
} from "@/services/goszakupki";
import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
import { ColumnVisibilityDropdown } from "@/shared/components/data-table/column-visibility-dropdown";
import { DataTable } from "@/shared/components/data-table/data-table";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";
import { ROUTES } from "@/shared/model/routes";

import { createColumns } from "./columns";

const PlansPage = () => {
  const navigate = useNavigate();

  // "Вид колонок" должен стоять в одном ряду с заголовком и кнопкой
  // синхронизации (CardHeader), но реальный экземпляр tanstack-table
  // существует только внутри DataTable (CardContent ниже) — поэтому вместо
  // рендера на месте используем портал в этот DOM-узел хедера. useState
  // (не useRef) — чтобы при монтировании ref-колбэка компонент
  // перерендерился и подхватил ненулевой контейнер для портала.
  const [columnsSlot, setColumnsSlot] = useState<HTMLDivElement | null>(null);

  const { data, isLoading } = rqClient.useQuery("get", "/api/purchases/", {});

  const syncAllMutation = useSyncAllPurchases();
  const { sync: syncItems, syncingPurchaseId } = useSyncPurchaseItemsAction();

  const handleSyncAll = () => {
    syncAllMutation.mutate(undefined, {
      onSuccess: (stats) => {
        if (stats.status === "success") {
          toast.success(stats.message);
          queryClient.invalidateQueries({
            queryKey: ["get", "/api/purchases/"],
          });
        } else {
          toast.info(stats.message);
        }
      },
      onError: (error) =>
        handleHttpError(error, "Не удалось обновить список планов с ЭТП", true),
    });
  };

  const columns = useMemo(
    () => createColumns(syncItems, syncingPurchaseId),
    [syncItems, syncingPurchaseId],
  );

  const handleRowClick = (row: Purchase) => {
    navigate({
      pathname: ROUTES.PLAN_ITEMS,
      search: `?purchase=${row.id}&limit=20&offset=0`,
    });
  };

  return (
    <Card className="max-w-full flex-1 gap-2 bg-transparent ring-0">
      <CardHeader className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div>
          <CardTitle>Годовые планы</CardTitle>
          <p className="text-muted-foreground text-[12px]">
            Реестр годовых планов государственных закупок
          </p>
        </div>
        <div ref={setColumnsSlot} className="flex w-[32rem] justify-center" />
        <Button
          onClick={handleSyncAll}
          disabled={syncAllMutation.isPending}
          className="justify-self-end">
          {syncAllMutation.isPending && (
            <Loader2Icon size={16} className="animate-spin" />
          )}
          Синхронизировать список планов закупок с ЭТП
        </Button>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <DataTable
          data={data ?? []}
          columns={columns}
          getRow={handleRowClick}
          isLoading={isLoading}
          cellClassName="p-4 text-center"
          fillAvailableHeight
          persistenceKey="plans-list"
          actions={(table) =>
            columnsSlot &&
            createPortal(
              <ColumnVisibilityDropdown
                table={table}
                className="max-w-[32rem]"
              />,
              columnsSlot,
            )
          }
        />
      </CardContent>
    </Card>
  );
};

export const Component = PlansPage;
