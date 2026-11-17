import { useState } from "react";

import { Loader2Icon, PencilIcon } from "lucide-react";
import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
import { Button } from "@/shared/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { formatByn } from "@/shared/lib/helpers/format-money";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

type Props = {
  id: number;
  plannedCost: string;
};

// Drawer справа вместо инлайн-инпута в строке — тот же паттерн, что и у
// остальных точечных правок на карточке позиции плана (EditableBuyerField,
// EditableInternalEconomicClassField), для единообразия интерфейса.
export const EditablePlannedCostField = ({ id, plannedCost }: Props) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(plannedCost);

  const mutation = rqClient.useMutation(
    "patch",
    "/api/contract_quarterly_finance/{id}/",
  );

  const openDrawer = () => {
    setValue(plannedCost);
    setOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    mutation.mutate(
      { params: { path: { id } }, body: { planned_cost: value } },
      {
        onSuccess: () => {
          // Остаток считается на бэкенде от planned_cost — перезапрос подтянет
          // и его пересчитанное значение, не только новый план.
          queryClient.invalidateQueries({
            queryKey: ["get", "/api/contract_quarterly_finance/"],
          });
          toast.success("Плановая сумма сохранена");
          setOpen(false);
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось сохранить плановую сумму", true),
      },
    );
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <span>{formatByn(plannedCost)}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-5"
          onClick={openDrawer}>
          <PencilIcon size={12} className="text-muted-foreground" />
        </Button>
      </div>

      <Drawer open={open} onOpenChange={setOpen} direction="right">
        <DrawerContent className="flex flex-col">
          <DrawerHeader>
            <DrawerTitle>Изменить плановую сумму</DrawerTitle>
          </DrawerHeader>

          <form
            id="planned-cost-form"
            onSubmit={submit}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
            <Field>
              <FieldLabel>План (правится вручную), BYN</FieldLabel>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </Field>
          </form>

          <DrawerFooter>
            <Button
              type="submit"
              form="planned-cost-form"
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
