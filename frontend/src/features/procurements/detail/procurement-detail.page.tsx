import type { ColumnDef } from "@tanstack/react-table";

import { useMemo } from "react";

import { useParams } from "react-router";

import { DataTable } from "@/shared/components/data-table/data-table";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { cn } from "@/shared/lib/utils";

import { DetailField } from "./detail-field";
import {
  type FinancingDepartment,
  procurementDetailMock,
  type ProcurementStatus,
} from "./procurement.mock";

// Подпись и цвет бейджа для каждого статуса плана.
const statusMeta: Record<
  ProcurementStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Черновик",
    className: "bg-muted text-muted-foreground",
  },
  published: {
    label: "Опубликован",
    className: "bg-green-100 text-green-700",
  },
  archived: {
    label: "В архиве",
    className: "bg-amber-100 text-amber-700",
  },
};

// Формат даты для отображения (дд.мм.гггг).
const formatDate = (date?: Date | null) =>
  date ? new Intl.DateTimeFormat("ru-RU").format(date) : undefined;

// Формат суммы в BYN.
const formatMoney = (value?: number) =>
  value === undefined
    ? undefined
    : new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "BYN",
        maximumFractionDigits: 0,
      }).format(value);

// Формат суммы с явной подписью «BYN» (для блока финансирования).
const formatByn = (value?: number) =>
  value === undefined
    ? undefined
    : `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} BYN`;

const typeLabel: Record<string, string> = {
  work: "Работа/Услуга",
  product: "Товар",
};

const ProcurementDetailPage = () => {
  // ID берём из URL (а не из location.state) — так страница переживает
  // перезагрузку (F5) и открытие по прямой ссылке.
  const { id } = useParams();

  // Колонки таблицы подразделений внутри года финансирования.
  // «Сумма подразделения» — групповая колонка с 4 подколонками.
  const departmentColumns = useMemo<ColumnDef<FinancingDepartment, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Наименование подразделения",
      },
      {
        id: "quantity",
        header: "Количество",
        accessorFn: (row) => `${row.quantity} ${row.units}`,
      },
      // {
      //   header: "Сведения по финансированию подразделений",
      //   columns: [
      {
        accessorKey: "totalSum",
        header: "Общая сумма",
        cell: ({ getValue }) => formatByn(getValue<number>()),
      },
      {
        accessorKey: "treasurySum",
        header: "Сумма казначейства",
        cell: ({ getValue }) => formatByn(getValue<number>()),
      },
      {
        accessorKey: "ownFunds",
        header: "Собственные средства",
        cell: ({ getValue }) => formatByn(getValue<number>()),
      },
      {
        accessorKey: "customerPaymentSum",
        header: "Оплата со счетов заказчика",
        cell: ({ getValue }) => formatByn(getValue<number>()),
      },
    ],
    //   },
    // ],
    [],
  );

  // ─── Заготовки запросов ───────────────────────────────────────────────
  // Пока данные из мока. Включим, когда бэкенд отдаст эндпоинты.
  // const { data: plan, isLoading } = rqClient.useQuery(
  //   "get",
  //   "/api/procurements/{id}/",
  //   { params: { path: { id: Number(id) } } },
  // );
  // ──────────────────────────────────────────────────────────────────────
  const plan = procurementDetailMock.find((p) => String(p.id) === id);

  if (!plan) {
    return (
      <div className="text-muted-foreground p-6 text-sm">
        План с номером {id} не найден.
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Шапка плана */}
      <Card className="ring-0">
        <CardHeader className="px-2">
          <CardTitle className="text-lg font-semibold tracking-wide uppercase">
            План закупки № {plan.planPointNumber}
          </CardTitle>
          <CardAction>
            <Badge
              className={cn(
                "rounded-md px-3 py-1 text-sm font-semibold",
                statusMeta[plan.status].className,
              )}>
              {statusMeta[plan.status].label}
            </Badge>
          </CardAction>
        </CardHeader>
        <Separator />
        <CardContent className="grid grid-cols-2 gap-4 px-2 md:grid-cols-4">
          <DetailField
            label="Номер пункта плана"
            value={plan.planPointNumber}
          />
          <DetailField
            label="Наименование предмета закупки"
            value={plan.goodsName}
          />
          <DetailField
            label="Общее количество"
            value={`${plan.allVolume} ${plan.units}`}
          />
          <DetailField label="Общая сумма" value={formatMoney(plan.allCost)} />
        </CardContent>
      </Card>

      {/* Табы с секциями плана */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">Информация</TabsTrigger>
          <TabsTrigger value="planning">Планирование</TabsTrigger>
          <TabsTrigger value="contracts">
            Договоры
            {plan.contracts.length > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {plan.contracts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="payments">Платежи</TabsTrigger>
        </TabsList>

        {/* Таб «Информация» — скалярные поля предмета закупки */}
        <TabsContent value="info">
          <Card className="ring-0">
            <CardHeader className="px-2">
              <CardTitle className="text-base font-semibold tracking-wide uppercase">
                Предмет закупки
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="grid grid-cols-2 gap-4 px-2 md:grid-cols-3">
              <DetailField
                label="Номер пункта плана"
                value={plan.planPointNumber}
              />
              <DetailField label="Код ОКРБ" value={plan.okrbCode} />
              <DetailField label="Наименование по ОКРБ" value={plan.okrbName} />
              <DetailField
                label="Наименование предмета закупки"
                value={plan.goodsName}
              />
              <DetailField
                label="Тип (работа/услуга/товар)"
                value={typeLabel[plan.typeOfGoodsId]}
              />
              <DetailField label="Исполнитель" value={plan.customerId} />
              <DetailField
                label="Общее количество"
                value={`${plan.allVolume} ${plan.units}`}
              />
              <DetailField label="Ед. измерения" value={plan.units} />
              <DetailField
                label="Общая сумма"
                value={formatMoney(plan.allCost)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Таб «Планирование» */}
        <TabsContent value="planning">
          <Card className="ring-0">
            <CardHeader className="px-2">
              <CardTitle className="text-base font-semibold tracking-wide uppercase">
                Планирование
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="grid grid-cols-2 gap-4 px-2 md:grid-cols-3">
              <DetailField
                label="Категория расходов"
                value={plan.expenseCategory}
              />
              <DetailField label="Вид предмета" value={plan.viewObject} />
              <DetailField label="Вид процедуры" value={plan.viewProcedure} />
              <DetailField label="Позиция перечня" value={plan.itemList} />
              <DetailField label="Номер плана" value={plan.planNumber} />
              <DetailField
                label="Дата плана"
                value={formatDate(plan.planDate)}
              />
              <DetailField
                label="Дата изменения плана"
                value={formatDate(plan.planChangeDate)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Таб «Договоры» — вложенный список */}
        <TabsContent value="contracts">
          <Card className="ring-0">
            <CardHeader className="px-2">
              <CardTitle className="text-base font-semibold tracking-wide uppercase">
                Договоры
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-3 px-2">
              {plan.contracts.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  По этому плану договоров нет.
                </p>
              ) : (
                plan.contracts.map((contract) => (
                  <div
                    key={contract.id}
                    className="grid grid-cols-2 gap-4 rounded-md border p-3 md:grid-cols-4">
                    <DetailField
                      label="Номер договора"
                      value={contract.contractNumber}
                    />
                    <DetailField
                      label="Сумма"
                      value={formatMoney(contract.contractSum)}
                    />
                    <DetailField
                      label="Дата договора"
                      value={formatDate(contract.contractDate)}
                    />
                    <DetailField
                      label="Покупатель"
                      value={contract.buyer.shortName}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Таб «Платежи» — вложенный список (ленивая загрузка) */}
        <TabsContent value="payments">
          <Card className="ring-0">
            <CardHeader className="px-2">
              <CardTitle className="text-base font-semibold tracking-wide uppercase">
                Платежи
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="text-muted-foreground px-2 text-sm">
              Список платежей появится после подключения эндпоинта.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Сведения о финансировании — по годам, каждый год отдельным блоком */}
      <Card className="ring-0">
        <CardHeader className="px-2">
          <CardTitle className="text-base font-semibold tracking-wide uppercase">
            Сведения о финансировании
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-3 px-2">
          {plan.financing.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              По этому плану сведений о финансировании нет.
            </p>
          ) : (
            plan.financing.map((year) => (
              <div
                key={year.id}
                className="grid grid-cols-2 gap-4 rounded-md border p-3 md:grid-cols-3">
                <DetailField label="Год финансирования" value={year.year} />
                <DetailField
                  label="Сумма финансирования года, BYN"
                  value={formatByn(year.yearSum)}
                />
                <DetailField
                  label="Функциональная классификация"
                  value={year.functionalClass}
                />
                <DetailField
                  label="Экономическая классификация"
                  value={year.economicClass}
                />
                <DetailField
                  label="Эконом. классификация внутренняя"
                  value={year.economicClassInternal}
                />
                <DetailField
                  label="Программная классификация"
                  value={year.programClass}
                />
                <DetailField
                  label="Ведомственная классификация"
                  value={year.departmentalClass}
                />
                <DetailField label="УНК заказчика" value={year.customerUnp} />
                <DetailField label="Код ТК" value={year.tkCode} />
                <DetailField label="Код бюджета" value={year.budgetCode} />
                <DetailField
                  label="Наименование кода бюджета"
                  value={year.budgetCodeName}
                />
                <DetailField
                  label="Оплата со счетов казначейства, BYN"
                  value={formatByn(year.treasuryPayment)}
                />
                <DetailField
                  label="Оплата со счетов заказчика, BYN"
                  value={formatByn(year.customerPayment)}
                />
                <DetailField
                  label="Собственные средства, BYN"
                  value={formatByn(year.ownFunds)}
                />

                {/* Таблица разбивки по подразделениям */}
                <div className="col-span-full mt-5 space-y-3">
                  <CardHeader className="-px-1">
                    <CardTitle className="text-base font-semibold tracking-wide uppercase">
                      Сведения о финансировании подразделений
                    </CardTitle>
                  </CardHeader>
                  {/* <Separator /> */}
                  <DataTable
                    data={year.departments}
                    columns={departmentColumns}
                    pagination={false}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export const Component = ProcurementDetailPage;
