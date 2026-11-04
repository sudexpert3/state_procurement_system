import type { Department, TreasuryPayment } from "@/shared/api/schema";

import { useMemo, useRef } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Loader2Icon, XIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { DatePickerField } from "@/shared/components/form/date-picker-field";
import { InputField } from "@/shared/components/form/input-field";
import { Badge } from "@/shared/components/ui/badge";
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
import { Field, FieldError, FieldLabel } from "@/shared/components/ui/field";
import { Textarea } from "@/shared/components/ui/textarea";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

import {
  type PaymentFormInput,
  type PaymentFormValues,
  paymentSchema,
} from "./payment.schema";

const flattenDepartments = (nodes: Department[]): Department[] =>
  nodes.flatMap((node) => [node, ...flattenDepartments(node.sub_departments)]);

const defaultValues: PaymentFormInput = {
  mode: "contract",
  contract: null,
  departments: [],
  economic_class: null,
  functional_class: null,
  amount: 0,
  payment_date: new Date(),
  notice: "",
};

type Props = {
  open: boolean;
  item: TreasuryPayment | null;
  onClose: () => void;
  onSuccess: () => void;
};

export const PaymentForm = ({ open, item, onClose, onSuccess }: Props) => {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const isEdit = item !== null;

  const contractsQuery = rqClient.useQuery("get", "/api/contracts/", {
    params: { query: { limit: 1000 } },
  });
  const departmentsQuery = rqClient.useQuery("get", "/api/departments/", {
    params: { query: { is_active: true } },
  });
  const economicCodeQuery = rqClient.useQuery("get", "/api/economic_code/", {
    params: { query: { is_active: true } },
  });
  const functionalCodeQuery = rqClient.useQuery(
    "get",
    "/api/functional_code/",
    { params: { query: { is_active: true } } },
  );

  const departments = useMemo(
    // TODO: убрать приведение после исправления sub_departments в OpenAPI.
    () =>
      flattenDepartments(
        (departmentsQuery.data ?? []) as unknown as Department[],
      ),
    [departmentsQuery.data],
  );

  const createMutation = rqClient.useMutation("post", "/api/payments/");
  const updateMutation = rqClient.useMutation("patch", "/api/payments/{id}/");
  const isPending = createMutation.isPending || updateMutation.isPending;

  const formValues: PaymentFormInput = item
    ? {
        mode: item.contract ? "contract" : "free",
        contract: item.contract ?? null,
        departments: item.departments ?? [],
        economic_class: item.economic_class ?? null,
        functional_class: item.functional_class ?? null,
        amount: Number(item.amount ?? 0),
        payment_date: item.payment_date
          ? new Date(item.payment_date)
          : new Date(),
        notice: item.notice ?? "",
      }
    : defaultValues;

  const { control, handleSubmit, watch, setValue } = useForm<
    PaymentFormInput,
    unknown,
    PaymentFormValues
  >({
    resolver: zodResolver(paymentSchema),
    values: formValues,
  });

  const mode = watch("mode");
  const selectedDepartmentIds = watch("departments");

  const handleSuccess = (message: string) => {
    toast.success(message);
    onClose();
    onSuccess();
  };

  const submit = handleSubmit((values) => {
    // Сериализатор платежей читает readonly-поля (quarter/*_detail) как обязательные
    // в сгенерированном типе (drf-spectacular не умеет отмечать их optional при
    // вложенных сериализаторах) — на вход бэкенд их игнорирует. См. ту же причину
    // в services/change-requests/types.ts.
    const body = {
      contract: values.mode === "contract" ? values.contract : null,
      departments: values.mode === "free" ? values.departments : [],
      economic_class: values.mode === "free" ? values.economic_class : null,
      functional_class: values.mode === "free" ? values.functional_class : null,
      amount: String(values.amount),
      payment_date: format(values.payment_date, "yyyy-MM-dd"),
      notice: values.notice || null,
    } as unknown as TreasuryPayment;

    if (item) {
      updateMutation.mutate(
        { params: { path: { id: item.id } }, body },
        {
          onSuccess: () => handleSuccess("Платёж обновлён"),
          onError: (error) =>
            handleHttpError(error, "Не удалось сохранить платёж", true),
        },
      );
    } else {
      createMutation.mutate(
        { body },
        {
          onSuccess: () => handleSuccess("Платёж добавлен"),
          onError: (error) =>
            handleHttpError(error, "Не удалось создать платёж", true),
        },
      );
    }
  });

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()} direction="right">
      <DrawerContent className="flex flex-col" ref={portalContainerRef}>
        <DrawerHeader>
          <DrawerTitle>
            {isEdit ? "Редактировать платёж" : "Новый платёж"}
          </DrawerTitle>
        </DrawerHeader>

        <form
          id="payment-form"
          onSubmit={submit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
          <Controller
            name="mode"
            control={control}
            render={({ field }) => (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={field.value === "contract" ? "default" : "outline"}
                  onClick={() => field.onChange("contract")}>
                  По договору
                </Button>
                <Button
                  type="button"
                  variant={field.value === "free" ? "default" : "outline"}
                  onClick={() => field.onChange("free")}>
                  Свободный платёж
                </Button>
              </div>
            )}
          />

          {mode === "contract" && (
            <Controller
              name="contract"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Договор</FieldLabel>
                  <Combobox
                    items={contractsQuery.data?.results ?? []}
                    value={
                      contractsQuery.data?.results.find(
                        (c) => c.id === field.value,
                      ) ?? null
                    }
                    onValueChange={(contract) =>
                      field.onChange(contract?.id ?? null)
                    }
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
                        {contractsQuery.isLoading
                          ? "Загрузка..."
                          : "Договор не найден"}
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
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          )}

          {mode === "free" && (
            <>
              <Field>
                <FieldLabel>Подразделения</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {selectedDepartmentIds.map((id) => (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {departments.find((d) => d.id === id)?.short_name ?? id}
                      <button
                        type="button"
                        onClick={() =>
                          setValue(
                            "departments",
                            selectedDepartmentIds.filter((d) => d !== id),
                          )
                        }>
                        <XIcon size={12} />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Combobox
                  items={departments.filter(
                    (d) => !selectedDepartmentIds.includes(d.id),
                  )}
                  value={null as Department | null}
                  onValueChange={(department) => {
                    if (department) {
                      setValue("departments", [
                        ...selectedDepartmentIds,
                        department.id,
                      ]);
                    }
                  }}
                  itemToStringLabel={(d) => d?.short_name ?? ""}
                  itemToStringValue={(d) => (d ? String(d.id) : "")}>
                  <ComboboxInput
                    placeholder="Добавить подразделение..."
                    disabled={departmentsQuery.isLoading}
                  />
                  <ComboboxContent portalContainer={portalContainerRef}>
                    <ComboboxEmpty>Подразделение не найдено</ComboboxEmpty>
                    <ComboboxList>
                      {(d) => (
                        <ComboboxItem key={d.id} value={d}>
                          {d.short_name}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </Field>

              <Controller
                name="economic_class"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Статья ЭКР</FieldLabel>
                    <Combobox
                      items={economicCodeQuery.data ?? []}
                      value={
                        (economicCodeQuery.data ?? []).find(
                          (c) => c.id === field.value,
                        ) ?? null
                      }
                      onValueChange={(c) => field.onChange(c?.id ?? null)}
                      itemToStringLabel={(c) =>
                        c ? `${c.code_api} ${c.description ?? ""}` : ""
                      }
                      itemToStringValue={(c) => (c ? String(c.id) : "")}>
                      <ComboboxInput
                        placeholder="Поиск по коду..."
                        showClear
                        aria-invalid={fieldState.invalid}
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
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="functional_class"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Функциональная классификация</FieldLabel>
                    <Combobox
                      items={functionalCodeQuery.data ?? []}
                      value={
                        (functionalCodeQuery.data ?? []).find(
                          (c) => c.id === field.value,
                        ) ?? null
                      }
                      onValueChange={(c) => field.onChange(c?.id ?? null)}
                      itemToStringLabel={(c) =>
                        c ? `${c.code_api} ${c.description ?? ""}` : ""
                      }
                      itemToStringValue={(c) => (c ? String(c.id) : "")}>
                      <ComboboxInput
                        placeholder="Поиск по коду..."
                        showClear
                        aria-invalid={fieldState.invalid}
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
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </>
          )}

          <InputField
            control={control}
            name="amount"
            label="Сумма платежа, BYN"
            type="number"
            step="0.01"
            min={0}
            required
          />

          <DatePickerField
            control={control}
            name="payment_date"
            label="Дата платежа"
            placeholder="Выберите дату"
          />

          <Controller
            name="notice"
            control={control}
            render={({ field }) => (
              <Field>
                <FieldLabel>Примечание</FieldLabel>
                <Textarea {...field} />
              </Field>
            )}
          />
        </form>

        <DrawerFooter>
          <Button type="submit" form="payment-form" disabled={isPending}>
            {isPending && <Loader2Icon size={16} className="animate-spin" />}
            {isEdit ? "Сохранить" : "Добавить"}
          </Button>
          <DrawerClose asChild>
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
