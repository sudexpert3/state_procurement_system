import type { ChangeRequest } from "../types";

import { useState } from "react";

import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { useDeletePlanItems, usePushPlanItems } from "@/services/goszakupki";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatDate } from "@/shared/lib/helpers/format-date";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

import {
  useApproveChangeRequest,
  useChangeRequestForecastQuery,
  useRejectChangeRequest,
  useSubmitChangeRequest,
} from "../api";
import {
  CHANGE_REQUEST_STATUS_BADGE_VARIANT,
  CHANGE_REQUEST_STATUS_LABELS,
} from "../model";

import { ForecastView } from "./forecast-view";
import { RejectDialog } from "./reject-dialog";

type Props = {
  item: ChangeRequest;
  /** Скрыть кнопку "Отправить на проверку" — например, если черновик ещё правится отдельной формой. */
  hideSubmit?: boolean;
};

/**
 * Переиспользуемая панель действий заявки на изменение: статус, обоснование,
 * прогноз последствий и кнопки submit/approve/reject. Используется и в общем
 * списке заявок (features/change-requests), и прямо на карточке позиции плана
 * (features/plan-items/detail) — поэтому живёт в services, а не в features.
 */
export const ChangeRequestActions = ({ item, hideSubmit = false }: Props) => {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const forecastQuery = useChangeRequestForecastQuery(item.id);
  const { submit, isPending: isSubmitting } = useSubmitChangeRequest();
  const { approve, isPending: isApproving } = useApproveChangeRequest();
  const { reject, isPending: isRejecting } = useRejectChangeRequest();
  const pushMutation = usePushPlanItems();
  const deleteMutation = useDeletePlanItems();

  const handleSubmit = () => {
    submit(item.id, {
      onSuccess: () => toast.success("Заявка отправлена на проверку"),
      onError: (error) =>
        handleHttpError(error, "Не удалось отправить заявку", true),
    });
  };

  const handleApprove = () => {
    approve(item.id, {
      onSuccess: () => toast.success("Заявка одобрена"),
      onError: (error) =>
        handleHttpError(error, "Не удалось одобрить заявку", true),
    });
  };

  const handleReject = (reason: string) => {
    reject(
      item.id,
      { rejection_reason: reason },
      {
        onSuccess: () => {
          setRejectDialogOpen(false);
          toast.success("Заявка отклонена");
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось отклонить заявку", true),
      },
    );
  };

  const handleSendToGoszakupki = () => {
    if (!item.plan_item) return;

    const mutation =
      item.kind === "PLAN_ITEM_EXCLUSION" ? deleteMutation : pushMutation;

    mutation.mutate([item.plan_item], {
      onSuccess: (result) => {
        if (result.failed.length === 0) {
          toast.success(
            `Отправлено на goszakupki.by: ${result.succeeded.length} позиция(й)`,
          );
        } else {
          toast.error(
            `Ошибка на goszakupki.by: ${result.failed[0]?.error ?? "неизвестная ошибка"}`,
          );
        }
      },
      onError: (error) =>
        handleHttpError(error, "Не удалось отправить на goszakupki.by", true),
    });
  };

  const canSendToGoszakupki =
    item.status === "APPROVED" &&
    item.plan_item != null &&
    (item.kind === "PLAN_ITEM_CHANGE" || item.kind === "PLAN_ITEM_EXCLUSION");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Badge variant={CHANGE_REQUEST_STATUS_BADGE_VARIANT[item.status]}>
          {CHANGE_REQUEST_STATUS_LABELS[item.status]}
        </Badge>
        <span>Отправлена: {formatDate(item.submitted_at)}</span>
        <span>Решение: {formatDate(item.reviewed_at)}</span>
      </div>

      {item.reason && (
        <div>
          <p className="text-muted-foreground text-sm">Обоснование</p>
          <p className="text-sm">{item.reason}</p>
        </div>
      )}

      {item.status === "REJECTED" && item.rejection_reason && (
        <div>
          <p className="text-muted-foreground text-sm">Причина отклонения</p>
          <p className="text-sm">{item.rejection_reason}</p>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">Прогноз последствий</p>
        {forecastQuery.isLoading && <Skeleton className="h-24 w-full" />}
        {forecastQuery.isError && (
          <p className="text-destructive text-sm">
            Не удалось загрузить прогноз
          </p>
        )}
        {forecastQuery.data && (
          <ForecastView kind={item.kind} data={forecastQuery.data} />
        )}
      </div>

      <div className="flex justify-end gap-2">
        {item.status === "DRAFT" && !hideSubmit && (
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2Icon size={16} className="animate-spin" />}
            Отправить на проверку
          </Button>
        )}
        {item.status === "ON_REVIEW" && (
          <>
            <Button
              variant="destructive"
              onClick={() => setRejectDialogOpen(true)}
              disabled={isRejecting}>
              Отклонить
            </Button>
            <Button onClick={handleApprove} disabled={isApproving}>
              {isApproving && (
                <Loader2Icon size={16} className="animate-spin" />
              )}
              Одобрить
            </Button>
          </>
        )}
        {canSendToGoszakupki && (
          <Button
            variant="outline"
            onClick={handleSendToGoszakupki}
            disabled={pushMutation.isPending || deleteMutation.isPending}>
            {(pushMutation.isPending || deleteMutation.isPending) && (
              <Loader2Icon size={16} className="animate-spin" />
            )}
            Отправить на goszakupki.by
          </Button>
        )}
      </div>

      <RejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        onConfirm={handleReject}
        isPending={isRejecting}
      />
    </div>
  );
};
