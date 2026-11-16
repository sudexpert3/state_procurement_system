import type { InternalEconomicCode } from "@/shared/api/schema";

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

type CurrentClass = { id: number; code: string; name: string } | null;

type Props = {
  /** id записи BudgetCosts (года/классификатора) */
  budgetCostId: number;
  currentClass: CurrentClass;
  /** Прямое редактирование (без заявки на изменение) — роли ADMIN_MAIN/FINANCIER, см. core/choices.py */
  canEdit: boolean;
  onSuccess: () => void;
};

// Присваиваемый код — только лист дерева (статья, уровень 4); промежуточные
// узлы (раздел/подраздел/вид) — группы классификатора, backend сам
// довычисляет их из internal_economic_class при сохранении.
const flattenLeaves = (nodes: InternalEconomicCode[]): InternalEconomicCode[] =>
  nodes.flatMap((node) =>
    node.sub_codes.length === 0 ? [node] : flattenLeaves(node.sub_codes),
  );

export const EditableInternalEconomicClassField = ({
  budgetCostId,
  currentClass,
  canEdit,
  onSuccess,
}: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selected, setSelected] = useState<CurrentClass>(currentClass);

  const codesQuery = rqClient.useQuery(
    "get",
    "/api/internal_economic_code/",
    {},
    { enabled: isEditing },
  );
  const leaves = flattenLeaves(
    // TODO: убрать приведение после исправления sub_codes в OpenAPI (см. InternalEconomicCode в shared/api/schema).
    (codesQuery.data ?? []) as unknown as InternalEconomicCode[],
  );
  const mutation = rqClient.useMutation("patch", "/api/budget_costs/{id}/");

  const startEditing = () => {
    setSelected(currentClass);
    setIsEditing(true);
  };

  const save = () => {
    mutation.mutate(
      {
        params: { path: { id: budgetCostId } },
        body: { internal_economic_class: selected?.id ?? null },
      },
      {
        onSuccess: () => {
          toast.success("Внутренняя классификация ЭКР обновлена");
          setIsEditing(false);
          onSuccess();
        },
        onError: (error) =>
          handleHttpError(
            error,
            "Не удалось изменить внутреннюю классификацию ЭКР",
            true,
          ),
      },
    );
  };

  if (!isEditing) {
    return (
      <DetailField
        label="Экономическая классификация внутренняя"
        value={
          currentClass ? `${currentClass.code} - ${currentClass.name}` : null
        }
        action={
          canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="size-5"
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
      <FieldLabel>Экономическая классификация внутренняя</FieldLabel>
      <div className="flex items-center gap-1">
        <Combobox
          items={leaves}
          value={leaves.find((leaf) => leaf.id === selected?.id) ?? null}
          onValueChange={setSelected}
          itemToStringLabel={(leaf) =>
            leaf ? `${leaf.code} - ${leaf.name}` : ""
          }
          itemToStringValue={(leaf) => (leaf ? String(leaf.id) : "")}
          autoHighlight>
          <ComboboxInput
            placeholder="Поиск по коду/наименованию..."
            disabled={codesQuery.isLoading}
            showClear
          />
          <ComboboxContent>
            <ComboboxEmpty>
              {codesQuery.isLoading ? "Загрузка..." : "Не найдено"}
            </ComboboxEmpty>
            <ComboboxList>
              {(leaf: InternalEconomicCode) => (
                <ComboboxItem key={leaf.id} value={leaf}>
                  {leaf.code} - {leaf.name}
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
