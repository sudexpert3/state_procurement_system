import type { Buyer } from "@/shared/api/schema";

import { useRef, useState } from "react";

import { Loader2Icon, PencilIcon } from "lucide-react";
import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { DetailField } from "@/shared/components/detail-field";
import { Button } from "@/shared/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/components/ui/combobox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

type Props = {
  /** id активной версии PlanItemDetail — null, пока не загрузилась */
  detailId: number | null;
  currentBuyer: Buyer | null;
  /** Прямое редактирование (без заявки на изменение) — роли ADMIN_MAIN/FINANCIER, см. core/choices.py */
  canEdit: boolean;
  onSuccess: () => void;
};

// Drawer справа — тот же принцип, что и у редактирования «Сведения о
// финансировании подразделений» (cost-department-drawer.tsx), а не
// инлайн-редактирование в строке — для единообразия интерфейса карточки.
export const EditableBuyerField = ({
  detailId,
  currentBuyer,
  canEdit,
  onSuccess,
}: Props) => {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Buyer | null>(currentBuyer);

  const buyersQuery = rqClient.useQuery(
    "get",
    "/api/buyers/",
    { params: { query: { is_active: true } } },
    { enabled: open },
  );
  const mutation = rqClient.useMutation(
    "patch",
    "/api/plan_items_details/{id}/",
  );

  const openDrawer = () => {
    setSelected(currentBuyer);
    setOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!detailId) return;

    mutation.mutate(
      {
        params: { path: { id: detailId } },
        body: { buyer: selected?.id ?? null },
      },
      {
        onSuccess: () => {
          toast.success("Исполнитель обновлён");
          setOpen(false);
          onSuccess();
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось изменить исполнителя", true),
      },
    );
  };

  return (
    <>
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
              onClick={openDrawer}>
              <PencilIcon size={12} className="text-muted-foreground" />
            </Button>
          )
        }
      />

      <Drawer open={open} onOpenChange={setOpen} direction="right">
        <DrawerContent className="flex flex-col" ref={portalContainerRef}>
          <DrawerHeader>
            <DrawerTitle>Изменить исполнителя</DrawerTitle>
          </DrawerHeader>

          <form
            id="buyer-edit-form"
            onSubmit={submit}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
            <Field>
              <FieldLabel>Исполнитель</FieldLabel>
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
                <ComboboxContent portalContainer={portalContainerRef}>
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
            </Field>
          </form>

          <DrawerFooter>
            <Button
              type="submit"
              form="buyer-edit-form"
              disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2Icon size={16} className="animate-spin" />
              )}
              Сохранить
            </Button>
            <DrawerClose asChild>
              <Button type="button" variant="outline">
                Отмена
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};
