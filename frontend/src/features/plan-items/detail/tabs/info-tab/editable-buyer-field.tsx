import type { Buyer } from "@/shared/api/schema";

import { useState } from "react";

import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { Button } from "@/shared/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/components/ui/combobox";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

import { DetailField } from "../../components/detail-field";

type Props = {
  /** id активной записи PlanItemDetail — null, пока не загрузилась */
  detailId: number | null;
  currentBuyer: Buyer | null;
  /** Прямое редактирование (без заявки на изменение) — роли ADMIN_MAIN/FINANCIER, см. core/choices.py */
  canEdit: boolean;
  onSuccess: () => void;
};

export const EditableBuyerField = ({
  detailId,
  currentBuyer,
  canEdit,
  onSuccess,
}: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selected, setSelected] = useState<Buyer | null>(currentBuyer);

  const buyersQuery = rqClient.useQuery(
    "get",
    "/api/buyers/",
    { params: { query: { is_active: true } } },
    { enabled: isEditing },
  );
  const mutation = rqClient.useMutation(
    "patch",
    "/api/plan_items_details/{id}/",
  );

  const startEditing = () => {
    setSelected(currentBuyer);
    setIsEditing(true);
  };

  const save = () => {
    if (!detailId) return;
    mutation.mutate(
      {
        params: { path: { id: detailId } },
        body: { buyer: selected?.id ?? null },
      },
      {
        onSuccess: () => {
          toast.success("Исполнитель обновлён");
          setIsEditing(false);
          onSuccess();
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось изменить исполнителя", true),
      },
    );
  };

  if (!isEditing) {
    return (
      <DetailField
        label="Исполнитель"
        value={currentBuyer?.shot_name ?? "Нет исполнителя"}
        action={
          canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="size-5"
              disabled={!detailId}
              onClick={startEditing}>
              <PencilIcon size={12} className="text-muted-foreground" />
            </Button>
          )
        }
      />
    );
  }

  return (
    <Field>
      <FieldLabel>Исполнитель</FieldLabel>
      <div className="flex items-center gap-1">
        <Combobox
          items={buyersQuery.data ?? []}
          value={selected}
          onValueChange={setSelected}
          itemToStringLabel={(buyer) => buyer?.shot_name ?? ""}
          itemToStringValue={(buyer) => (buyer ? String(buyer.id) : "")}
          autoHighlight>
          <ComboboxInput
            placeholder="Поиск по ФИО..."
            disabled={buyersQuery.isLoading}
            showClear
          />
          <ComboboxContent>
            <ComboboxEmpty>
              {buyersQuery.isLoading ? "Загрузка..." : "Не найдено"}
            </ComboboxEmpty>
            <ComboboxList>
              {(buyer: Buyer) => (
                <ComboboxItem key={buyer.id} value={buyer}>
                  {buyer.shot_name}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <Button
          size="icon"
          variant="ghost"
          onClick={save}
          disabled={mutation.isPending}>
          <CheckIcon size={16} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setIsEditing(false)}
          disabled={mutation.isPending}>
          <XIcon size={16} />
        </Button>
      </div>
    </Field>
  );
};
