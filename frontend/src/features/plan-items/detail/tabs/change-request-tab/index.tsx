import { useState } from "react";

import { toast } from "sonner";

import {
  ChangeRequestActions,
  useCreateChangeRequest,
  usePlanItemChangeRequestsQuery,
} from "@/services/change-requests";
import { SectionCard } from "@/shared/components/section-card";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

import { DraftEditor } from "./draft-editor";
import { ReasonDialog } from "./reason-dialog";

type DialogState = "PLAN_ITEM_CHANGE" | "PLAN_ITEM_EXCLUSION" | null;

export const ChangeRequestTab = ({ planItemId }: { planItemId: number }) => {
  const [dialog, setDialog] = useState<DialogState>(null);

  const { data, isLoading } = usePlanItemChangeRequestsQuery(planItemId);
  const { create, isPending: isCreating } = useCreateChangeRequest();

  const openRequest = data?.results.find(
    (item) => item.status === "DRAFT" || item.status === "ON_REVIEW",
  );
  const history = data?.results.filter((item) => item !== openRequest) ?? [];

  const handleCreate = (reason: string) => {
    if (!dialog) return;

    create(
      { plan_item: planItemId, kind: dialog, reason: reason || undefined },
      {
        onSuccess: () => {
          setDialog(null);
          toast.success("Заявка создана");
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось создать заявку", true),
      },
    );
  };

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {!openRequest && (
        <div className="flex gap-2">
          <Button onClick={() => setDialog("PLAN_ITEM_CHANGE")}>
            Изменить позицию
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDialog("PLAN_ITEM_EXCLUSION")}>
            Исключить позицию
          </Button>
        </div>
      )}

      {openRequest && (
        <SectionCard
          title={`Заявка №${openRequest.id} на ${
            openRequest.kind === "PLAN_ITEM_CHANGE" ? "изменение" : "исключение"
          }`}>
          <div className="flex flex-col gap-4 px-2 py-4">
            {openRequest.kind === "PLAN_ITEM_CHANGE" &&
              openRequest.status === "DRAFT" && (
                <DraftEditor changeRequestId={openRequest.id} />
              )}
            <ChangeRequestActions item={openRequest} />
          </div>
        </SectionCard>
      )}

      {history.length > 0 && (
        <SectionCard title="История заявок по этой позиции">
          <div className="flex flex-col gap-2 px-2 py-4 text-sm">
            {history.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  №{item.id} —{" "}
                  {item.kind === "PLAN_ITEM_CHANGE"
                    ? "изменение"
                    : "исключение"}
                </span>
                <span className="text-muted-foreground">
                  {item.status_display}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <ReasonDialog
        open={dialog === "PLAN_ITEM_CHANGE"}
        title="Создать заявку на изменение позиции"
        description="Обоснование опционально — можно уточнить позже перед отправкой на проверку."
        onOpenChange={(open) => !open && setDialog(null)}
        onConfirm={handleCreate}
        isPending={isCreating}
      />
      <ReasonDialog
        open={dialog === "PLAN_ITEM_EXCLUSION"}
        title="Создать заявку на исключение позиции"
        description="Обоснование обязательно — заявка сразу уйдёт на проверку финансисту."
        required
        onOpenChange={(open) => !open && setDialog(null)}
        onConfirm={handleCreate}
        isPending={isCreating}
      />
    </div>
  );
};
