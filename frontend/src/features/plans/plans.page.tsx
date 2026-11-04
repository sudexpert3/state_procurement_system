import type { Purchase } from "@/shared/api/schema";

import { useCallback, useMemo } from "react";

import { Loader2Icon } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import {
  useSyncAllPurchases,
  useSyncPurchaseItems,
} from "@/services/goszakupki";
import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
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
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";
import { ROUTES } from "@/shared/model/routes";

import { createColumns } from "./columns";

const PlansPage = () => {
  const navigate = useNavigate();

  const { data, isLoading } = rqClient.useQuery("get", "/api/purchases/", {});

  const syncAllMutation = useSyncAllPurchases();
  const syncItemsMutation = useSyncPurchaseItems();

  const handleSyncAll = () => {
    syncAllMutation.mutate(undefined, {
      onSuccess: (stats) => {
        toast.success(
          `Синхронизация завершена: ${stats.details.imported_plan_item_count ?? 0} новых, ${stats.details.updated_plan_item_count ?? 0} обновлено`,
        );
        queryClient.invalidateQueries({ queryKey: ["get", "/api/purchases/"] });
      },
      onError: (error) =>
        handleHttpError(error, "Не удалось синхронизировать с ЭТП", true),
    });
  };

  const handleSyncItems = useCallback(
    (purchaseId: number) => {
      syncItemsMutation.mutate(purchaseId, {
        onSuccess: (stats) => {
          toast.success(
            `Позиции плана синхронизированы: ${stats.details.imported_plan_item_count ?? 0} новых, ${stats.details.updated_plan_item_count ?? 0} обновлено`,
          );
        },
        onError: (error) =>
          handleHttpError(
            error,
            "Не удалось синхронизировать позиции плана",
            true,
          ),
      });
    },
    [syncItemsMutation],
  );

  const columns = useMemo(
    () => createColumns(handleSyncItems, syncItemsMutation.isPending),
    [handleSyncItems, syncItemsMutation.isPending],
  );

  const handleRowClick = (row: Purchase) => {
    navigate({
      pathname: ROUTES.PLAN_ITEMS,
      search: `?purchase=${row.id}&limit=20&offset=0`,
    });
  };

  return (
    <Card className="max-w-full gap-2 bg-transparent ring-0">
      <CardHeader>
        <CardTitle>Годовые планы</CardTitle>
        <CardDescription className="text-[12px]">
          Реестр годовых планов государственных закупок
        </CardDescription>
        <CardAction>
          <Button onClick={handleSyncAll} disabled={syncAllMutation.isPending}>
            {syncAllMutation.isPending && (
              <Loader2Icon size={16} className="animate-spin" />
            )}
            Синхронизировать с ЭТП
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <DataTable
          data={data ?? []}
          columns={columns}
          getRow={handleRowClick}
          isLoading={isLoading}
          cellClassName="p-4 text-center"
        />
      </CardContent>
    </Card>
  );
};

export const Component = PlansPage;
