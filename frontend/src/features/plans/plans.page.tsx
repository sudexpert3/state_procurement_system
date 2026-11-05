import type { Purchase } from "@/shared/api/schema";

import { useMemo } from "react";

import { Loader2Icon } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import {
  useSyncAllPurchases,
  useSyncPurchaseItemsAction,
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
            Синхронизировать список планов закупок с ЭТП
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <DataTable
          data={data ?? []}
          columns={columns}
          getRow={handleRowClick}
          isLoading={isLoading}
          cellClassName="p-4 text-center"
          fillAvailableHeight
        />
      </CardContent>
    </Card>
  );
};

export const Component = PlansPage;
