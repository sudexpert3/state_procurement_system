import type { ApiSchemas, Department } from "@/shared/api/schema";

import { useMemo, useRef, useState } from "react";

import { Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
import { Button } from "@/shared/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/components/ui/combobox";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

type InternalCode = { id: number; code: string; name: string };

const flattenDepartments = (nodes: Department[]): Department[] =>
  nodes.flatMap((node) => [node, ...flattenDepartments(node.sub_departments)]);

const flattenInternalCodes = (
  nodes: (InternalCode & { sub_codes: unknown })[],
): InternalCode[] =>
  nodes.flatMap((node) => [
    node,
    // TODO: убрать приведение после исправления sub_codes в OpenAPI.
    ...flattenInternalCodes(
      (node.sub_codes ?? []) as (InternalCode & { sub_codes: unknown })[],
    ),
  ]);

const invalidateLimits = () =>
  queryClient.invalidateQueries({
    queryKey: ["get", "/api/department_article_limits/"],
  });

export type CalibrationContext = {
  functional_class: number;
  economic_class: number;
  year: number;
};

const AddHolderRow = ({
  changeRequestId,
  context,
  internalEconomicClass,
  excludedDepartmentIds,
}: {
  changeRequestId: number;
  context: CalibrationContext;
  internalEconomicClass: number;
  excludedDepartmentIds: number[];
}) => {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [amount, setAmount] = useState("0");

  const departmentsQuery = rqClient.useQuery("get", "/api/departments/", {
    params: { query: { is_active: true } },
  });
  const departments = useMemo(
    () =>
      flattenDepartments(
        // TODO: убрать приведение после исправления sub_departments в OpenAPI.
        (departmentsQuery.data ?? []) as unknown as Department[],
      ).filter((d) => !excludedDepartmentIds.includes(d.id)),
    [departmentsQuery.data, excludedDepartmentIds],
  );

  const mutation = rqClient.useMutation(
    "post",
    "/api/department_article_limits/",
  );

  const handleAdd = () => {
    if (!department) return;

    mutation.mutate(
      {
        body: {
          ...context,
          internal_economic_class: internalEconomicClass,
          department: department.id,
          amount,
          change_request: changeRequestId,
          status: "DRAFT",
        } as unknown as ApiSchemas["DepartmentArticleLimit"],
      },
      {
        onSuccess: () => {
          invalidateLimits();
          setDepartment(null);
          setAmount("0");
          toast.success("Держатель добавлен");
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось добавить держателя", true),
      },
    );
  };

  return (
    <div className="flex items-center gap-2 pl-6" ref={portalContainerRef}>
      <Combobox
        items={departments}
        value={department}
        onValueChange={setDepartment}
        itemToStringLabel={(d) => d?.short_name ?? ""}
        itemToStringValue={(d) => (d ? String(d.id) : "")}>
        <ComboboxInput
          placeholder="Добавить держателя..."
          disabled={departmentsQuery.isLoading}
          className="w-56"
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
      <Input
        type="number"
        step="0.01"
        min={0}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-40"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={!department || mutation.isPending}
        onClick={handleAdd}>
        {mutation.isPending ? (
          <Loader2Icon size={16} className="animate-spin" />
        ) : (
          <PlusIcon size={16} />
        )}
      </Button>
    </div>
  );
};

const AddSubarticleRow = ({
  changeRequestId,
  context,
  excludedCodeIds,
}: {
  changeRequestId: number;
  context: CalibrationContext;
  excludedCodeIds: number[];
}) => {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const [code, setCode] = useState<InternalCode | null>(null);
  const [amount, setAmount] = useState("0");

  const codesQuery = rqClient.useQuery("get", "/api/internal_economic_code/", {
    params: { query: { is_active: true } },
  });
  const codes = useMemo(
    () =>
      flattenInternalCodes(
        (codesQuery.data ?? []) as unknown as (InternalCode & {
          sub_codes: unknown;
        })[],
      ).filter((c) => !excludedCodeIds.includes(c.id)),
    [codesQuery.data, excludedCodeIds],
  );

  const mutation = rqClient.useMutation(
    "post",
    "/api/department_article_limits/",
  );

  const handleAdd = () => {
    if (!code) return;

    mutation.mutate(
      {
        body: {
          ...context,
          internal_economic_class: code.id,
          department: null,
          amount,
          change_request: changeRequestId,
          status: "DRAFT",
        } as unknown as ApiSchemas["DepartmentArticleLimit"],
      },
      {
        onSuccess: () => {
          invalidateLimits();
          setCode(null);
          setAmount("0");
          toast.success("Подстатья добавлена");
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось добавить подстатью", true),
      },
    );
  };

  return (
    <div className="flex items-center gap-2" ref={portalContainerRef}>
      <Combobox
        items={codes}
        value={code}
        onValueChange={setCode}
        itemToStringLabel={(c) => (c ? `${c.code} ${c.name}` : "")}
        itemToStringValue={(c) => (c ? String(c.id) : "")}>
        <ComboboxInput
          placeholder="Добавить подстатью..."
          disabled={codesQuery.isLoading}
          className="w-64"
        />
        <ComboboxContent portalContainer={portalContainerRef}>
          <ComboboxEmpty>Код не найден</ComboboxEmpty>
          <ComboboxList>
            {(c) => (
              <ComboboxItem key={c.id} value={c}>
                {c.code} — {c.name}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <Input
        type="number"
        step="0.01"
        min={0}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-40"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={!code || mutation.isPending}
        onClick={handleAdd}>
        {mutation.isPending ? (
          <Loader2Icon size={16} className="animate-spin" />
        ) : (
          <PlusIcon size={16} />
        )}
      </Button>
    </div>
  );
};

const AmountInput = ({
  id,
  amount,
  onSaved,
}: {
  id: number;
  amount: string;
  onSaved: () => void;
}) => {
  const mutation = rqClient.useMutation(
    "patch",
    "/api/department_article_limits/{id}/",
  );

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const next = event.target.value;
    if (next === amount) return;

    mutation.mutate(
      // Эта панель редактирует только черновики (status=DRAFT) — status
      // обязателен в Patched-типе из-за default=ACTIVE на модели, но здесь
      // не меняется, только переподтверждается.
      { params: { path: { id } }, body: { status: "DRAFT", amount: next } },
      {
        onSuccess: () => {
          invalidateLimits();
          onSaved();
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось сохранить сумму", true),
      },
    );
  };

  return (
    <Input
      type="number"
      step="0.01"
      min={0}
      defaultValue={amount}
      onBlur={handleBlur}
      disabled={mutation.isPending}
      className="w-40"
    />
  );
};

const DeleteRowButton = ({ id }: { id: number }) => {
  const mutation = rqClient.useMutation(
    "delete",
    "/api/department_article_limits/{id}/",
  );

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      disabled={mutation.isPending}
      onClick={() =>
        mutation.mutate(
          { params: { path: { id } } },
          { onSuccess: invalidateLimits },
        )
      }>
      <XIcon size={14} className="text-muted-foreground" />
    </Button>
  );
};

type Props = {
  changeRequestId: number;
  context: CalibrationContext;
};

export const DepartmentArticleLimitsEditor = ({
  changeRequestId,
  context,
}: Props) => {
  const query = rqClient.useQuery("get", "/api/department_article_limits/", {
    params: { query: { change_request: changeRequestId, status: "DRAFT" } },
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;

  const rows = query.data?.results ?? [];
  const subarticles = rows.filter((r) => r.department === null);
  const existingCodeIds = subarticles.map((r) => r.internal_economic_class);

  return (
    <div className="flex flex-col gap-4">
      {subarticles.map((subarticle) => {
        const holders = rows.filter(
          (r): r is typeof r & { department: number } =>
            r.department !== null &&
            r.internal_economic_class === subarticle.internal_economic_class,
        );

        return (
          <div key={subarticle.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 font-medium">
              <span className="w-64">
                {subarticle.internal_economic_class_code}
              </span>
              <AmountInput
                id={subarticle.id}
                amount={subarticle.amount ?? "0"}
                onSaved={() => toast.success("Сумма подстатьи сохранена")}
              />
              <DeleteRowButton id={subarticle.id} />
            </div>
            {holders.map((holder) => (
              <div key={holder.id} className="flex items-center gap-2 pl-6">
                <span className="w-56 text-sm">{holder.department_name}</span>
                <AmountInput
                  id={holder.id}
                  amount={holder.amount ?? "0"}
                  onSaved={() => toast.success("Сумма держателя сохранена")}
                />
                <DeleteRowButton id={holder.id} />
              </div>
            ))}
            <AddHolderRow
              changeRequestId={changeRequestId}
              context={context}
              internalEconomicClass={subarticle.internal_economic_class}
              excludedDepartmentIds={holders.map((h) => h.department)}
            />
          </div>
        );
      })}

      <AddSubarticleRow
        changeRequestId={changeRequestId}
        context={context}
        excludedCodeIds={existingCodeIds}
      />
    </div>
  );
};
