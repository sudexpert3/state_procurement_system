import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
import { SectionCard } from "@/shared/components/section-card";
import { Button } from "@/shared/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

const invalidateDraftQueries = () => {
  queryClient.invalidateQueries({
    queryKey: ["get", "/api/plan_items_details/"],
  });
  queryClient.invalidateQueries({ queryKey: ["get", "/api/budget_costs/"] });
  queryClient.invalidateQueries({ queryKey: ["get", "/api/plan_shares/"] });
};

const detailSchema = z.object({
  title: z.string().min(1, "Укажите наименование"),
  val_amount: z.coerce.number<number>().min(0, "Не может быть отрицательным"),
  fund_cost: z.coerce.number<number>().min(0, "Не может быть отрицательным"),
  inner_cost: z.coerce.number<number>().min(0, "Не может быть отрицательным"),
});

type DetailFormValues = z.output<typeof detailSchema>;

const DetailDraftForm = ({
  detailId,
  defaultValues,
}: {
  detailId: number;
  defaultValues: DetailFormValues;
}) => {
  const mutation = rqClient.useMutation(
    "patch",
    "/api/plan_items_details/{id}/",
  );

  const { control, handleSubmit } = useForm<DetailFormValues>({
    resolver: zodResolver(detailSchema),
    values: defaultValues,
  });

  const submit = handleSubmit((values) => {
    mutation.mutate(
      {
        params: { path: { id: detailId } },
        body: {
          title: values.title,
          val_amount: String(values.val_amount),
          fund_cost: String(values.fund_cost),
          inner_cost: String(values.inner_cost),
        },
      },
      {
        onSuccess: () => {
          invalidateDraftQueries();
          toast.success("Черновик сохранён");
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось сохранить черновик", true),
      },
    );
  });

  return (
    <form
      onSubmit={submit}
      className="grid grid-cols-1 gap-4 px-2 py-4 md:grid-cols-4">
      <Controller
        name="title"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="md:col-span-4">
            <FieldLabel>Наименование предмета закупки</FieldLabel>
            <Input {...field} aria-invalid={fieldState.invalid} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="val_amount"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>Количество</FieldLabel>
            <Input
              {...field}
              type="number"
              step="any"
              min={0}
              aria-invalid={fieldState.invalid}
            />
          </Field>
        )}
      />
      <Controller
        name="fund_cost"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>Внебюджетные фонды, BYN</FieldLabel>
            <Input
              {...field}
              type="number"
              step="0.01"
              min={0}
              aria-invalid={fieldState.invalid}
            />
          </Field>
        )}
      />
      <Controller
        name="inner_cost"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>Собственные средства, BYN</FieldLabel>
            <Input
              {...field}
              type="number"
              step="0.01"
              min={0}
              aria-invalid={fieldState.invalid}
            />
          </Field>
        )}
      />
      <div className="flex items-end md:col-span-4">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && (
            <Loader2Icon size={16} className="animate-spin" />
          )}
          Сохранить черновик
        </Button>
      </div>
    </form>
  );
};

const BudgetCostRow = ({
  id,
  year,
  cost,
}: {
  id: number;
  year: number;
  cost: string;
}) => {
  const mutation = rqClient.useMutation("patch", "/api/budget_costs/{id}/");

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const next = event.target.value;
    if (next === cost) return;

    mutation.mutate(
      { params: { path: { id } }, body: { cost: next } },
      {
        onSuccess: () => {
          invalidateDraftQueries();
          toast.success(`Сумма за ${year} год сохранена`);
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось сохранить сумму", true),
      },
    );
  };

  return (
    <div className="flex items-center gap-4">
      <span className="w-20 text-sm">{year} год</span>
      <Input
        type="number"
        step="0.01"
        min={0}
        defaultValue={cost}
        onBlur={handleBlur}
        disabled={mutation.isPending}
        className="max-w-48"
      />
    </div>
  );
};

const PlanShareRow = ({
  id,
  departmentName,
  sharedCost,
}: {
  id: number;
  departmentName: string;
  sharedCost: string;
}) => {
  const mutation = rqClient.useMutation("patch", "/api/plan_shares/{id}/");

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const next = event.target.value;
    if (next === sharedCost) return;

    mutation.mutate(
      { params: { path: { id } }, body: { shared_cost: next } },
      {
        onSuccess: () => {
          invalidateDraftQueries();
          toast.success(`Сумма для «${departmentName}» сохранена`);
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось сохранить сумму", true),
      },
    );
  };

  return (
    <div className="flex items-center gap-4">
      <span className="w-48 text-sm">{departmentName}</span>
      <Input
        type="number"
        step="0.01"
        min={0}
        defaultValue={sharedCost}
        onBlur={handleBlur}
        disabled={mutation.isPending}
        className="max-w-48"
      />
    </div>
  );
};

type Props = {
  changeRequestId: number;
};

export const DraftEditor = ({ changeRequestId }: Props) => {
  const detailQuery = rqClient.useQuery("get", "/api/plan_items_details/", {
    params: { query: { change_request: changeRequestId, status: "DRAFT" } },
  });
  const budgetCostsQuery = rqClient.useQuery("get", "/api/budget_costs/", {
    params: { query: { change_request: changeRequestId, status: "DRAFT" } },
  });
  const planSharesQuery = rqClient.useQuery("get", "/api/plan_shares/", {
    params: { query: { change_request: changeRequestId, status: "DRAFT" } },
  });
  const departmentsQuery = rqClient.useQuery("get", "/api/departments/", {
    params: { query: { is_active: true } },
  });

  const departmentNameById = new Map<number, string>();
  const collectNames = (
    nodes: { id: number; short_name: string; sub_departments: unknown }[],
  ) => {
    for (const node of nodes) {
      departmentNameById.set(node.id, node.short_name);
      // TODO: убрать приведение после исправления sub_departments в OpenAPI (см. Department в shared/api/schema).
      collectNames((node.sub_departments ?? []) as typeof nodes);
    }
  };
  collectNames(
    (departmentsQuery.data ?? []) as {
      id: number;
      short_name: string;
      sub_departments: unknown;
    }[],
  );

  const detail = detailQuery.data?.results[0];

  if (
    detailQuery.isLoading ||
    budgetCostsQuery.isLoading ||
    planSharesQuery.isLoading
  ) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!detail) {
    return (
      <p className="text-muted-foreground text-sm">
        Черновик не найден — возможно, заявка уже отправлена на проверку.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Предмет закупки (черновик)">
        <DetailDraftForm
          detailId={detail.id}
          defaultValues={{
            title: detail.title ?? "",
            val_amount: Number(detail.val_amount ?? 0),
            fund_cost: Number(detail.fund_cost ?? 0),
            inner_cost: Number(detail.inner_cost ?? 0),
          }}
        />
      </SectionCard>

      <SectionCard title="Финансирование по годам (черновик)">
        <div className="flex flex-col gap-3 px-2 py-4">
          {budgetCostsQuery.data?.results.length ? (
            budgetCostsQuery.data.results.map((row) => (
              <BudgetCostRow
                key={row.id}
                id={row.id}
                year={row.year ?? 0}
                cost={row.cost ?? "0"}
              />
            ))
          ) : (
            <p className="text-muted-foreground text-sm">Нет данных</p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Распределение по подразделениям (черновик)">
        <div className="flex flex-col gap-3 px-2 py-4">
          {planSharesQuery.data?.results.length ? (
            planSharesQuery.data.results.map((row) => (
              <PlanShareRow
                key={row.id}
                id={row.id}
                departmentName={
                  departmentNameById.get(row.department) ?? `#${row.department}`
                }
                sharedCost={row.shared_cost ?? "0"}
              />
            ))
          ) : (
            <p className="text-muted-foreground text-sm">
              Лимит ещё не распределён по подразделениям
            </p>
          )}
        </div>
      </SectionCard>

      <p className="text-muted-foreground text-sm">
        Изменения сохраняются по каждому полю отдельно (при потере фокуса).
        Когда всё готово — отправьте заявку на проверку кнопкой ниже.
      </p>
    </div>
  );
};
