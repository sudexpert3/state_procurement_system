import { useState } from "react";

import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  type RedistributionLinePayload,
  useCreateRedistribution,
} from "@/services/change-requests";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

const emptyLine: RedistributionLinePayload = {
  budget_cost: 0,
  plan_share: null,
  quarter: "Q1",
  amount: "0",
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: (createdId: number) => void;
};

export const RedistributionForm = ({ open, onClose, onSuccess }: Props) => {
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<RedistributionLinePayload[]>([
    { ...emptyLine },
    { ...emptyLine },
  ]);

  const { createRedistribution, isPending } = useCreateRedistribution();

  const updateLine = (
    index: number,
    patch: Partial<RedistributionLinePayload>,
  ) =>
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );

  const close = () => {
    setReason("");
    setLines([{ ...emptyLine }, { ...emptyLine }]);
    onClose();
  };

  const handleSubmit = () => {
    createRedistribution(
      { reason, lines },
      {
        onSuccess: (created) => {
          toast.success("Заявка на перераспределение создана");
          close();
          onSuccess(created.id);
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось создать заявку", true),
      },
    );
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && close()} direction="right">
      <DrawerContent className="flex flex-col sm:max-w-2xl">
        <DrawerHeader>
          <DrawerTitle>
            Перераспределение лимита между статьями/кварталами
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
          <p className="text-muted-foreground text-sm">
            Для каждой строки укажите ID записи «Финансирование года» (
            <code>BudgetCosts</code>) — его видно в разделе «Заявка на
            изменение» карточки позиции плана. ID «Распределение по
            подразделению» (<code>PlanShare</code>) заполняйте только если
            строка касается конкретного держателя лимита, иначе оставьте пустым
            — тогда правится лимит статьи целиком. Сумма новых минус старых
            значений по всем строкам должна быть равна нулю — это проверяется на
            сервере.
          </p>

          <Field>
            <FieldLabel>Обоснование</FieldLabel>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>

          <div className="flex flex-col gap-3">
            {lines.map((line, index) => (
              <div key={index} className="flex items-end gap-2">
                <Field className="w-36">
                  <FieldLabel>ID BudgetCosts</FieldLabel>
                  <Input
                    type="number"
                    value={line.budget_cost || ""}
                    onChange={(e) =>
                      updateLine(index, { budget_cost: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field className="w-36">
                  <FieldLabel>ID PlanShare (опц.)</FieldLabel>
                  <Input
                    type="number"
                    value={line.plan_share ?? ""}
                    onChange={(e) =>
                      updateLine(index, {
                        plan_share: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </Field>
                <Field className="w-32">
                  <FieldLabel>Квартал</FieldLabel>
                  <Select
                    value={line.quarter}
                    onValueChange={(v) =>
                      updateLine(index, {
                        quarter: v as RedistributionLinePayload["quarter"],
                      })
                    }>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value="Q1">I квартал</SelectItem>
                        <SelectItem value="Q2">II квартал</SelectItem>
                        <SelectItem value="Q3">III квартал</SelectItem>
                        <SelectItem value="Q4">IV квартал</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="w-40">
                  <FieldLabel>Новая сумма, BYN</FieldLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={line.amount}
                    onChange={(e) =>
                      updateLine(index, { amount: e.target.value })
                    }
                  />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={lines.length <= 2}
                  onClick={() =>
                    setLines((prev) => prev.filter((_, i) => i !== index))
                  }>
                  <Trash2Icon size={16} className="text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setLines((prev) => [...prev, { ...emptyLine }])}>
            <PlusIcon size={16} />
            Добавить строку
          </Button>
        </div>

        <DrawerFooter>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2Icon size={16} className="animate-spin" />}
            Создать заявку
          </Button>
          <DrawerClose asChild>
            <Button type="button" variant="outline" onClick={close}>
              Отмена
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
