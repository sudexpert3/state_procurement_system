import type { ProcurementDetail } from "../procurement.mock";

import { CardContent } from "@/shared/components/ui/card";
import { formatByn, formatMoney } from "@/shared/lib/helpers/format-money";

import { DepartmentsTable } from "../departments-table";
import { DetailField } from "../detail-field";
import { typeLabel } from "../plan-meta";
import { SectionCard } from "../section-card";

// Таб «Информация» — скалярные поля предмета закупки + сведения о финансировании.
export const InfoTab = ({ plan }: { plan: ProcurementDetail }) => (
  <div className="space-y-4">
    <SectionCard title="Предмет закупки">
      <CardContent className="grid grid-cols-2 gap-4 px-2 md:grid-cols-3">
        <DetailField label="Номер пункта плана" value={plan.planPointNumber} />
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
        <DetailField label="Общая сумма" value={formatMoney(plan.allCost)} />
      </CardContent>
    </SectionCard>

    {/* Сведения о финансировании — по годам, каждый год отдельным блоком */}
    <SectionCard title="Сведения о финансировании">
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

              <DepartmentsTable
                title="Сведения о финансировании подразделений"
                data={year.departments}
              />
            </div>
          ))
        )}
      </CardContent>
    </SectionCard>
  </div>
);
