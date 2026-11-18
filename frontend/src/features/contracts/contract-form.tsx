import type { Contract } from "@/shared/api/schema";

import { useRef } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Loader2Icon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
import { DatePickerField } from "@/shared/components/form/date-picker-field";
import { InputField } from "@/shared/components/form/input-field";
import { TextAreaField } from "@/shared/components/form/text-area-field";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/components/ui/combobox";
import { DrawerFooter } from "@/shared/components/ui/drawer";
import { Field, FieldError, FieldLabel } from "@/shared/components/ui/field";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

import {
  type ContractFormInput,
  type ContractFormValues,
  contractSchema,
} from "./contract.schema";

type ProcurementMethodNode = {
  id: number;
  name: string;
  sub_methods: ProcurementMethodNode[];
};

const flattenProcurementMethods = (
  nodes: ProcurementMethodNode[],
): ProcurementMethodNode[] =>
  nodes.flatMap((node) => [
    node,
    ...flattenProcurementMethods(node.sub_methods),
  ]);

const emptyValues: ContractFormInput = {
  number: "",
  contract_date: null,
  supplier: null,
  total_cost: 0,
  buyer: null,
  payment_terms: "",
  planned_delivery_date: null,
  notice: "",
  is_registered_in_treasury: false,
  construction_type: "",
  procurement_method_detail: null,
  fixed_assets_plan_item: "",
  parent_contract: null,
};

type Props = {
  item: Contract | null;
  onCancel: () => void;
  onSuccess: (contract: Contract) => void;
};

/**
 * Форма заголовка договора (создание/редактирование) — спецификация,
 * платежи и квартальный план/факт сюда не входят, они редактируются
 * отдельно (ContractItem/TreasuryPayment/ContractQuarterlyFinance). Не
 * оборачивает собственный `Drawer` — рендерится как содержимое уже открытого
 * (родителем) `DrawerContent`, чтобы один и тот же компонент можно было
 * использовать и для отдельного Drawer'а «Добавить договор», и как режим
 * «Редактировать» внутри Drawer'а просмотра карточки (см. `contract-detail.tsx`).
 */
export const ContractForm = ({ item, onCancel, onSuccess }: Props) => {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const isEdit = item !== null;

  const suppliersQuery = rqClient.useQuery("get", "/api/suppliers/");
  const buyersQuery = rqClient.useQuery("get", "/api/buyers/", {
    params: { query: { is_active: true } },
  });
  const procurementMethodsQuery = rqClient.useQuery(
    "get",
    "/api/procurement_methods/",
    { params: { query: { is_active: true } } },
  );
  const procurementMethods = flattenProcurementMethods(
    // TODO: убрать приведение после исправления sub_methods в OpenAPI (см.
    // тот же баг у sub_departments/sub_codes в shared/api/schema/index.ts).
    (procurementMethodsQuery.data ?? []) as unknown as ProcurementMethodNode[],
  );
  // Для выбора основного договора (Доп. соглашения) — тот же приём, что у
  // выбора договора в payment-form.tsx (limit=1000 покрывает весь реестр).
  const contractsQuery = rqClient.useQuery("get", "/api/contracts/", {
    params: { query: { limit: 1000 } },
  });
  const parentContractOptions = (contractsQuery.data?.results ?? []).filter(
    (c) => c.id !== item?.id,
  );

  const createMutation = rqClient.useMutation("post", "/api/contracts/");
  const updateMutation = rqClient.useMutation("patch", "/api/contracts/{id}/");
  const isPending = createMutation.isPending || updateMutation.isPending;

  const formValues: ContractFormInput = item
    ? {
        number: item.number,
        contract_date: item.contract_date ? new Date(item.contract_date) : null,
        supplier: item.supplier,
        total_cost: Number(item.total_cost),
        buyer: item.buyer ?? null,
        payment_terms: item.payment_terms ?? "",
        planned_delivery_date: item.planned_delivery_date
          ? new Date(item.planned_delivery_date)
          : null,
        notice: item.notice ?? "",
        is_registered_in_treasury: item.is_registered_in_treasury ?? false,
        construction_type: item.construction_type ?? "",
        procurement_method_detail: item.procurement_method_detail ?? null,
        fixed_assets_plan_item: item.fixed_assets_plan_item ?? "",
        parent_contract: item.parent_contract ?? null,
      }
    : emptyValues;

  const { control, handleSubmit } = useForm<
    ContractFormInput,
    unknown,
    ContractFormValues
  >({
    resolver: zodResolver(contractSchema),
    values: formValues,
  });

  const handleSuccess = (message: string, contract: Contract) => {
    queryClient.invalidateQueries({ queryKey: ["get", "/api/contracts/"] });
    toast.success(message);
    onSuccess(contract);
  };

  const submit = handleSubmit((values) => {
    const body = {
      number: values.number,
      contract_date: values.contract_date
        ? format(values.contract_date, "yyyy-MM-dd")
        : null,
      supplier: values.supplier,
      total_cost: String(values.total_cost),
      buyer: values.buyer,
      payment_terms: values.payment_terms || null,
      // Схема рефайнит planned_delivery_date как обязательное — здесь уже
      // гарантированно не null, типизация z.refine этого не отражает.
      planned_delivery_date: format(
        values.planned_delivery_date!,
        "yyyy-MM-dd",
      ),
      notice: values.notice || null,
      is_registered_in_treasury: values.is_registered_in_treasury,
      construction_type: values.construction_type || null,
      procurement_method_detail: values.procurement_method_detail,
      fixed_assets_plan_item: values.fixed_assets_plan_item || null,
      parent_contract: values.parent_contract,
    } as unknown as Contract;

    if (item) {
      updateMutation.mutate(
        { params: { path: { id: item.id } }, body },
        {
          onSuccess: (updated) => handleSuccess("Договор обновлён", updated),
          onError: (error) =>
            handleHttpError(error, "Не удалось сохранить договор", true),
        },
      );
    } else {
      createMutation.mutate(
        { body },
        {
          onSuccess: (created) => handleSuccess("Договор добавлен", created),
          onError: (error) =>
            handleHttpError(error, "Не удалось создать договор", true),
        },
      );
    }
  });

  return (
    <div ref={portalContainerRef} className="contents">
      <form
        id="contract-form"
        onSubmit={submit}
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
        <InputField
          control={control}
          name="number"
          label="№ договора"
          placeholder="52311"
          required
        />

        <Controller
          name="parent_contract"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Основной договор (для Доп. соглашений)</FieldLabel>
              <Combobox
                items={parentContractOptions}
                value={
                  parentContractOptions.find((c) => c.id === field.value) ??
                  null
                }
                onValueChange={(parent) => field.onChange(parent?.id ?? null)}
                itemToStringLabel={(c) => (c ? `${c.number}` : "")}
                itemToStringValue={(c) => (c ? String(c.id) : "")}
                autoHighlight>
                <ComboboxInput
                  placeholder="Поиск по номеру договора..."
                  disabled={contractsQuery.isLoading}
                  showClear
                  aria-invalid={fieldState.invalid}
                />
                <ComboboxContent portalContainer={portalContainerRef}>
                  <ComboboxEmpty>
                    {contractsQuery.isLoading ? "Загрузка..." : "Не найдено"}
                  </ComboboxEmpty>
                  <ComboboxList>
                    {(c) => (
                      <ComboboxItem key={c.id} value={c}>
                        {c.number} — {c.supplier_detail.name}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <DatePickerField
          control={control}
          name="contract_date"
          label="Дата заключения"
          placeholder="Выберите дату"
        />

        <Controller
          name="supplier"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Контрагент (поставщик)</FieldLabel>
              <Combobox
                items={suppliersQuery.data ?? []}
                value={
                  (suppliersQuery.data ?? []).find(
                    (s) => s.id === field.value,
                  ) ?? null
                }
                onValueChange={(supplier) =>
                  field.onChange(supplier?.id ?? null)
                }
                itemToStringLabel={(s) => s?.name ?? ""}
                itemToStringValue={(s) => (s ? String(s.id) : "")}
                autoHighlight>
                <ComboboxInput
                  placeholder="Поиск по наименованию..."
                  disabled={suppliersQuery.isLoading}
                  showClear
                  aria-invalid={fieldState.invalid}
                />
                <ComboboxContent portalContainer={portalContainerRef}>
                  <ComboboxEmpty>
                    {suppliersQuery.isLoading ? "Загрузка..." : "Не найдено"}
                  </ComboboxEmpty>
                  <ComboboxList>
                    {(s) => (
                      <ComboboxItem key={s.id} value={s}>
                        {s.name}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <InputField
          control={control}
          name="total_cost"
          label="Сумма договора, BYN"
          placeholder="0.00"
          type="number"
          step="0.01"
          min={0}
          required
        />

        <DatePickerField
          control={control}
          name="planned_delivery_date"
          label="Плановая дата исполнения"
          placeholder="Выберите дату"
        />

        <Controller
          name="buyer"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Закупщик</FieldLabel>
              <Combobox
                items={buyersQuery.data ?? []}
                value={
                  (buyersQuery.data ?? []).find((b) => b.id === field.value) ??
                  null
                }
                onValueChange={(buyer) => field.onChange(buyer?.id ?? null)}
                itemToStringLabel={(b) => b?.shot_name ?? ""}
                itemToStringValue={(b) => (b ? String(b.id) : "")}
                autoHighlight>
                <ComboboxInput
                  placeholder="Поиск по ФИО..."
                  disabled={buyersQuery.isLoading}
                  showClear
                  aria-invalid={fieldState.invalid}
                />
                <ComboboxContent portalContainer={portalContainerRef}>
                  <ComboboxEmpty>
                    {buyersQuery.isLoading ? "Загрузка..." : "Не найдено"}
                  </ComboboxEmpty>
                  <ComboboxList>
                    {(b) => (
                      <ComboboxItem key={b.id} value={b}>
                        {b.shot_name}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="procurement_method_detail"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Вид процедуры закупки</FieldLabel>
              <Combobox
                items={procurementMethods}
                value={
                  procurementMethods.find((m) => m.id === field.value) ?? null
                }
                onValueChange={(method) => field.onChange(method?.id ?? null)}
                itemToStringLabel={(m) => m?.name ?? ""}
                itemToStringValue={(m) => (m ? String(m.id) : "")}
                autoHighlight>
                <ComboboxInput
                  placeholder="Поиск по наименованию..."
                  disabled={procurementMethodsQuery.isLoading}
                  showClear
                  aria-invalid={fieldState.invalid}
                />
                <ComboboxContent portalContainer={portalContainerRef}>
                  <ComboboxEmpty>
                    {procurementMethodsQuery.isLoading
                      ? "Загрузка..."
                      : "Не найдено"}
                  </ComboboxEmpty>
                  <ComboboxList>
                    {(m) => (
                      <ComboboxItem key={m.id} value={m}>
                        {m.name}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <TextAreaField
          control={control}
          name="payment_terms"
          label="Условия оплаты"
          placeholder="Например: оплата 1 раз в квартал по 18 150,0 р."
        />

        <InputField
          control={control}
          name="construction_type"
          label="Вид строительных работ / объект строительства"
          placeholder="Необязательно"
        />

        <InputField
          control={control}
          name="fixed_assets_plan_item"
          label="Пункт перечня плана основных средств"
          placeholder="Необязательно"
        />

        <TextAreaField
          control={control}
          name="notice"
          label="Примечание / дополнительная информация"
        />

        <Controller
          name="is_registered_in_treasury"
          control={control}
          render={({ field }) => (
            <Field orientation="horizontal">
              <Checkbox
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
              <FieldLabel className="font-normal">
                Регистрация в территориальном казначействе
              </FieldLabel>
            </Field>
          )}
        />
      </form>

      <DrawerFooter>
        <Button type="submit" form="contract-form" disabled={isPending}>
          {isPending && <Loader2Icon size={16} className="animate-spin" />}
          {isEdit ? "Сохранить" : "Добавить"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}>
          Отмена
        </Button>
      </DrawerFooter>
    </div>
  );
};
