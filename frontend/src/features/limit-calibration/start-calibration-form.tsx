import { useRef, useState } from "react";

import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { useCalibrateDepartmentLimits } from "@/services/change-requests";
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
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

type EconomicCode = {
  id: number;
  code_api: string;
  description?: string | null;
};
type FunctionalCode = {
  id: number;
  code_api: string;
  description?: string | null;
};

type Props = {
  onCreated: (
    changeRequestId: number,
    context: { functional_class: number; economic_class: number; year: number },
  ) => void;
};

export const StartCalibrationForm = ({ onCreated }: Props) => {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const [functionalClass, setFunctionalClass] = useState<FunctionalCode | null>(
    null,
  );
  const [economicClass, setEconomicClass] = useState<EconomicCode | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [reason, setReason] = useState("");

  const functionalCodeQuery = rqClient.useQuery(
    "get",
    "/api/functional_code/",
    { params: { query: { is_active: true } } },
  );
  const economicCodeQuery = rqClient.useQuery("get", "/api/economic_code/", {
    params: { query: { is_active: true } },
  });

  const { calibrate, isPending } = useCalibrateDepartmentLimits();

  const handleSubmit = () => {
    if (!functionalClass || !economicClass) return;

    calibrate(
      {
        functional_class: functionalClass.id,
        economic_class: economicClass.id,
        year,
        reason,
      },
      {
        onSuccess: (created) => {
          toast.success("Калибровка начата");
          onCreated(created.id, {
            functional_class: functionalClass.id,
            economic_class: economicClass.id,
            year,
          });
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось начать калибровку", true),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4" ref={portalContainerRef}>
      <div className="flex gap-4">
        <Field className="w-72">
          <FieldLabel>Функциональная классификация</FieldLabel>
          <Combobox
            items={functionalCodeQuery.data ?? []}
            value={functionalClass}
            onValueChange={setFunctionalClass}
            itemToStringLabel={(c) =>
              c ? `${c.code_api} ${c.description ?? ""}` : ""
            }
            itemToStringValue={(c) => (c ? String(c.id) : "")}>
            <ComboboxInput
              placeholder="Поиск по коду..."
              disabled={functionalCodeQuery.isLoading}
              showClear
            />
            <ComboboxContent portalContainer={portalContainerRef}>
              <ComboboxEmpty>Не найдено</ComboboxEmpty>
              <ComboboxList>
                {(c) => (
                  <ComboboxItem key={c.id} value={c}>
                    {c.code_api} — {c.description}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </Field>

        <Field className="w-72">
          <FieldLabel>Статья ЭКР</FieldLabel>
          <Combobox
            items={economicCodeQuery.data ?? []}
            value={economicClass}
            onValueChange={setEconomicClass}
            itemToStringLabel={(c) =>
              c ? `${c.code_api} ${c.description ?? ""}` : ""
            }
            itemToStringValue={(c) => (c ? String(c.id) : "")}>
            <ComboboxInput
              placeholder="Поиск по коду..."
              disabled={economicCodeQuery.isLoading}
              showClear
            />
            <ComboboxContent portalContainer={portalContainerRef}>
              <ComboboxEmpty>Не найдено</ComboboxEmpty>
              <ComboboxList>
                {(c) => (
                  <ComboboxItem key={c.id} value={c}>
                    {c.code_api} — {c.description}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </Field>

        <Field className="w-32">
          <FieldLabel>Год</FieldLabel>
          <Input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </Field>
      </div>

      <Field>
        <FieldLabel>Обоснование</FieldLabel>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>

      <div>
        <Button
          onClick={handleSubmit}
          disabled={!functionalClass || !economicClass || isPending}>
          {isPending && <Loader2Icon size={16} className="animate-spin" />}
          Начать калибровку
        </Button>
      </div>
    </div>
  );
};
