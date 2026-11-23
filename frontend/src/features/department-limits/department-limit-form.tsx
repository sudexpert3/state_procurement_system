import type {
  ApiSchemas,
  Department,
  DepartmentArticleLimit,
  InternalEconomicCode,
} from "@/shared/api/schema";

import { useMemo, useRef } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useDebounceValue } from "@siberiacancode/reactuse";
import { format } from "date-fns";
import { Loader2Icon } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { DatePickerField } from "@/shared/components/form/date-picker-field";
import { InputField } from "@/shared/components/form/input-field";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/shared/components/ui/field";
import { Textarea } from "@/shared/components/ui/textarea";
import { formatByn } from "@/shared/lib/helpers/format-money";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";
import { cn } from "@/shared/lib/utils";

import { useArticleAvailability } from "./hooks/use-article-availability";
import {
  type DepartmentLimitFormInput,
  type DepartmentLimitFormValues,
  departmentLimitSchema,
} from "./department-limits.schema";
import { flattenDepartments, flattenInternalCodeLeaves } from "./flatten-tree";

type Props = {
  open: boolean;
  item: DepartmentArticleLimit | null;
  defaultYear: number;
  onClose: () => void;
  onSuccess: () => void;
};

const buildDefaultValues = (defaultYear: number): DepartmentLimitFormInput => ({
  functional_class: null,
  economic_class: null,
  internal_economic_class: null,
  department: null,
  year: defaultYear,
  amount: 0,
  note: "",
  effective_date: new Date(),
  deactivated_at: null,
});

export const DepartmentLimitForm = ({
  open,
  item,
  defaultYear,
  onClose,
  onSuccess,
}: Props) => {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const isEdit = item !== null;
  // ACTIVE/ARCHIVE — бэкенд принимает PATCH только по note/deactivated_at,
  // остальные поля меняют новой записью + активацией (см. CurrentStatus.md).
  const isLocked = item !== null && item.status !== "DRAFT";

  const functionalCodeQuery = rqClient.useQuery(
    "get",
    "/api/functional_code/",
    { params: { query: { is_active: true } } },
  );
  const economicCodeQuery = rqClient.useQuery("get", "/api/economic_code/", {
    params: { query: { is_active: true } },
  });
  const departmentsQuery = rqClient.useQuery("get", "/api/departments/", {
    params: { query: { is_active: true } },
  });
  const internalCodeQuery = rqClient.useQuery(
    "get",
    "/api/internal_economic_code/",
    {},
  );

  const departments = useMemo(
    () =>
      flattenDepartments(
        // TODO: убрать приведение после исправления sub_departments в OpenAPI.
        (departmentsQuery.data ?? []) as unknown as Department[],
      ),
    [departmentsQuery.data],
  );
  const internalCodeLeaves = useMemo(
    () =>
      flattenInternalCodeLeaves(
        // TODO: убрать приведение после исправления sub_codes в OpenAPI.
        (internalCodeQuery.data ?? []) as unknown as InternalEconomicCode[],
      ),
    [internalCodeQuery.data],
  );

  const createMutation = rqClient.useMutation(
    "post",
    "/api/department_article_limits/",
  );
  const updateMutation = rqClient.useMutation(
    "patch",
    "/api/department_article_limits/{id}/",
  );
  const activateMutation = rqClient.useMutation(
    "post",
    "/api/department_article_limits/{id}/activate/",
  );
  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    activateMutation.isPending;

  // react-hook-form сверяет `values` на каждый рендер (deep-equal) и делает
  // reset(), если значение изменилось — `new Date()` внутри buildDefaultValues
  // без мемоизации создавал новый Date на КАЖДЫЙ рендер (разная миллисекунда),
  // reset() зацикливался ("Maximum update depth exceeded"). Пересчитываем
  // только когда реально меняется открываемая запись/год по умолчанию.
  const formValues: DepartmentLimitFormInput = useMemo(
    () =>
      item
        ? {
            functional_class: item.functional_class,
            economic_class: item.economic_class,
            internal_economic_class: item.internal_economic_class,
            department: item.department,
            year: item.year,
            amount: Number(item.amount ?? 0),
            note: item.note ?? "",
            effective_date: item.effective_date
              ? new Date(item.effective_date)
              : new Date(),
            deactivated_at: item.deactivated_at
              ? new Date(item.deactivated_at)
              : null,
          }
        : buildDefaultValues(defaultYear),
    [item, defaultYear],
  );

  const { control, handleSubmit } = useForm<
    DepartmentLimitFormInput,
    unknown,
    DepartmentLimitFormValues
  >({
    resolver: zodResolver(departmentLimitSchema),
    values: formValues,
  });

  const [functionalClass, economicClass, year, amount] = useWatch({
    control,
    name: ["functional_class", "economic_class", "year", "amount"],
  });
  const debouncedAmount = useDebounceValue(amount, 300);

  const availability = useArticleAvailability({
    functionalClass,
    economicClass,
    year: year ?? null,
    exclude: item?.id,
  });

  const overAvailable =
    availability.data &&
    Number(debouncedAmount) + Number(availability.data.allocated_total) >
      Number(availability.data.available_limit);

  const handleSuccess = (message: string) => {
    toast.success(message);
    onClose();
    onSuccess();
  };

  // Создаёт/сохраняет запись, затем вызывает callback с её id (для
  // последующей активации) — общая часть «Сохранить черновик»/«Активировать».
  const saveLimit = (
    values: DepartmentLimitFormValues,
    onSaved: (id: number) => void,
  ) => {
    const body = {
      functional_class: values.functional_class!,
      economic_class: values.economic_class!,
      internal_economic_class: values.internal_economic_class!,
      department: values.department!,
      year: values.year,
      amount: String(values.amount),
      note: values.note,
      effective_date: format(values.effective_date, "yyyy-MM-dd"),
      deactivated_at: values.deactivated_at
        ? format(values.deactivated_at, "yyyy-MM-dd")
        : null,
    };

    if (item) {
      updateMutation.mutate(
        {
          params: { path: { id: item.id } },
          body: { status: item.status, ...body },
        },
        {
          onSuccess: () => onSaved(item.id),
          onError: (error) =>
            handleHttpError(error, "Не удалось сохранить запись", true),
        },
      );
    } else {
      createMutation.mutate(
        {
          // readonly-поля (id/status/*_code/...) DRF игнорирует на вход, но без
          // них объектный литерал не проходит структурную проверку типа — тот же
          // приём, что и в остальных create-мутациях проекта.
          body: body as unknown as ApiSchemas["DepartmentArticleLimit"],
        },
        {
          onSuccess: (created) => onSaved(created.id),
          onError: (error) =>
            handleHttpError(error, "Не удалось создать запись", true),
        },
      );
    }
  };

  const handleSaveDraft = handleSubmit((values) => {
    saveLimit(values, () => handleSuccess("Черновик сохранён"));
  });

  const handleActivate = handleSubmit((values) => {
    saveLimit(values, (id) => {
      activateMutation.mutate(
        { params: { path: { id } } },
        {
          onSuccess: () => handleSuccess("Лимит активирован"),
          onError: (error) =>
            handleHttpError(error, "Не удалось активировать запись", true),
        },
      );
    });
  });

  // ACTIVE/ARCHIVE — редактируются только note/deactivated_at, остальные
  // поля бэкенд всё равно отклонит (400).
  const handleSaveLocked = handleSubmit((values) => {
    if (!item) return;

    updateMutation.mutate(
      {
        params: { path: { id: item.id } },
        body: {
          status: item.status,
          note: values.note,
          deactivated_at: values.deactivated_at
            ? format(values.deactivated_at, "yyyy-MM-dd")
            : null,
        },
      },
      {
        onSuccess: () => handleSuccess("Запись сохранена"),
        onError: (error) =>
          handleHttpError(error, "Не удалось сохранить запись", true),
      },
    );
  });

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()} direction="right">
      <DrawerContent
        className={cn(
          "flex flex-col",
          // Базовые классы в drawer.tsx (w-3/4 / sm:max-w-sm = 24rem) заданы
          // через атрибутный селектор data-[vaul-drawer-direction=right] — он
          // специфичнее обычного класса, переопределять нужно той же
          // вариантной цепочкой (тот же приём, что в contract-detail.tsx/
          // payment-form.tsx). 72rem = 24rem × 3 — модалка шире в 3 раза.
          "data-[vaul-drawer-direction=right]:w-[72rem]",
          "data-[vaul-drawer-direction=right]:sm:max-w-[72rem]",
        )}
        ref={portalContainerRef}>
        <DrawerHeader>
          <DrawerTitle>
            {isEdit ? "Редактировать лимит" : "Новая запись лимита"}
          </DrawerTitle>
        </DrawerHeader>

        <form
          id="department-limit-form"
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
          <div className="flex gap-4">
            <DatePickerField
              control={control}
              name="effective_date"
              label="Дата записи"
              placeholder="Выберите дату"
              disabled={isLocked}
            />
            <DatePickerField
              control={control}
              name="deactivated_at"
              label="Дата деактивации"
              placeholder="Не указана"
            />
          </div>

          <InputField
            control={control}
            name="year"
            label="Год"
            type="number"
            disabled={isLocked}
            className="w-32"
          />

          <Controller
            name="functional_class"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Параграф</FieldLabel>
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
                    disabled={isLocked || functionalCodeQuery.isLoading}
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
                    disabled={isLocked || economicCodeQuery.isLoading}
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
            name="internal_economic_class"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Внутренний код ЭКР</FieldLabel>
                <Combobox
                  items={internalCodeLeaves}
                  value={
                    internalCodeLeaves.find((c) => c.id === field.value) ?? null
                  }
                  onValueChange={(c) => field.onChange(c?.id ?? null)}
                  itemToStringLabel={(c) => (c ? `${c.code} ${c.name}` : "")}
                  itemToStringValue={(c) => (c ? String(c.id) : "")}>
                  <ComboboxInput
                    placeholder="Поиск по коду/наименованию..."
                    disabled={isLocked || internalCodeQuery.isLoading}
                    showClear
                    aria-invalid={fieldState.invalid}
                  />
                  <ComboboxContent portalContainer={portalContainerRef}>
                    <ComboboxEmpty>Не найдено</ComboboxEmpty>
                    <ComboboxList>
                      {(c) => (
                        <ComboboxItem key={c.id} value={c}>
                          {c.code} — {c.name}
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
            name="department"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Подразделение (держатель лимита)</FieldLabel>
                <Combobox
                  items={departments}
                  value={departments.find((d) => d.id === field.value) ?? null}
                  onValueChange={(d) => field.onChange(d?.id ?? null)}
                  itemToStringLabel={(d) => d?.short_name ?? ""}
                  itemToStringValue={(d) => (d ? String(d.id) : "")}>
                  <ComboboxInput
                    placeholder="Поиск подразделения..."
                    disabled={isLocked || departmentsQuery.isLoading}
                    showClear
                    aria-invalid={fieldState.invalid}
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
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <InputField
            control={control}
            name="amount"
            label="Сумма лимита, BYN"
            type="number"
            step="0.01"
            min={0}
            disabled={isLocked}
            required
          />

          {availability.data && (
            <FieldDescription className="flex flex-col gap-1">
              <span>
                Доступно по статье/параграфу:{" "}
                {formatByn(availability.data.available_limit)}
              </span>
              <span>
                Уже распределено (без этой записи):{" "}
                {formatByn(availability.data.allocated_total)}
              </span>
              {overAvailable && (
                <span className="text-destructive font-medium">
                  Сумма превысит доступный остаток по статье — сохранение не
                  блокируется, но уйдёт в перерасход
                </span>
              )}
            </FieldDescription>
          )}

          <Controller
            name="note"
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
          {isLocked ? (
            <Button
              type="button"
              onClick={handleSaveLocked}
              disabled={isPending}>
              {isPending && <Loader2Icon size={16} className="animate-spin" />}
              Сохранить
            </Button>
          ) : (
            <>
              <Button
                type="button"
                onClick={handleActivate}
                disabled={isPending}>
                {isPending && (
                  <Loader2Icon size={16} className="animate-spin" />
                )}
                Активировать
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isPending}>
                Сохранить черновик
              </Button>
            </>
          )}
          <DrawerClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Отмена
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
