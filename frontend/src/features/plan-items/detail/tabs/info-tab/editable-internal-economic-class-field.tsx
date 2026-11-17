import type { InternalEconomicCode } from "@/shared/api/schema";

import { useRef, useState } from "react";

import { Loader2Icon, PencilIcon } from "lucide-react";
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

// Drawer справа — тот же принцип, что и у редактирования «Сведения о
// финансировании подразделений» (cost-department-drawer.tsx), а не
// инлайн-редактирование в строке — для единообразия интерфейса карточки.
// Заодно и даёт достаточно места для длинных кодов/наименований статей
// классификатора (раньше для этого искусственно растягивали ячейку сетки).
export const EditableInternalEconomicClassField = ({
  budgetCostId,
  currentClass,
  canEdit,
  onSuccess,
}: Props) => {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CurrentClass>(currentClass);

  const codesQuery = rqClient.useQuery(
    "get",
    "/api/internal_economic_code/",
    {},
    { enabled: open },
  );
  const leaves = flattenLeaves(
    // TODO: убрать приведение после исправления sub_codes в OpenAPI (см. InternalEconomicCode в shared/api/schema).
    (codesQuery.data ?? []) as unknown as InternalEconomicCode[],
  );
  const mutation = rqClient.useMutation("patch", "/api/budget_costs/{id}/");

  const openDrawer = () => {
    setSelected(currentClass);
    setOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    mutation.mutate(
      {
        params: { path: { id: budgetCostId } },
        body: { internal_economic_class: selected?.id ?? null },
      },
      {
        onSuccess: () => {
          toast.success("Внутренняя классификация ЭКР обновлена");
          setOpen(false);
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

  return (
    <>
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
              onClick={openDrawer}>
              <PencilIcon size={12} className="text-muted-foreground" />
            </Button>
          )
        }
      />

      <Drawer open={open} onOpenChange={setOpen} direction="right">
        <DrawerContent
          // Плейн `sm:max-w-xl` проигрывает по специфичности собственному
          // `data-[vaul-drawer-direction=right]:sm:max-w-sm` компонента
          // (атрибутивный селектор специфичнее обычного класса) — тот же
          // вариант нужен и для переопределения.
          className="flex flex-col data-[vaul-drawer-direction=right]:sm:max-w-xl"
          ref={portalContainerRef}>
          <DrawerHeader>
            <DrawerTitle>
              Изменить экономическую классификацию внутреннюю
            </DrawerTitle>
          </DrawerHeader>

          <form
            id="internal-economic-class-edit-form"
            onSubmit={submit}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
            <Field>
              <FieldLabel>Экономическая классификация внутренняя</FieldLabel>
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
                <ComboboxContent portalContainer={portalContainerRef}>
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
            </Field>
          </form>

          <DrawerFooter>
            <Button
              type="submit"
              form="internal-economic-class-edit-form"
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
