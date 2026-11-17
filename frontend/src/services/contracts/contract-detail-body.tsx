import type { Contract } from "@/shared/api/schema";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatDate } from "@/shared/lib/helpers/format-date";
import { formatByn } from "@/shared/lib/helpers/format-money";

import { QuarterlyFinanceTable } from "./quarterly-finance-table";

type Props = {
  contract: Contract;
  /**
   * id PlanShare (= ContractItem.plan_share) → короткое имя подразделения.
   * `ContractItem` отдаёт только id PlanShare, без названия подразделения
   * (бэкенд их не денормализует) — карта строится там, где эти PlanShare уже
   * загружены целиком (карточка позиции плана, см. `contracts-tab.tsx`).
   * В реестре договоров (`features/contracts/contract-detail.tsx`) такой
   * карты нет — колонка там покажет «—».
   */
  departmentByPlanShare?: Map<number, string>;
};

/**
 * Содержимое карточки договора (контрагент, спецификация, квартальный
 * план/факт) — переиспользуется и в Drawer'е реестра договоров
 * (`features/contracts/contract-detail.tsx`), и на карточке позиции плана
 * (таб «Договоры», см. CurrentStatus.md) — чтобы не дублировать разметку
 * между двумя местами, где показывается один и тот же договор.
 */
export const ContractDetailBody = ({
  contract,
  departmentByPlanShare,
}: Props) => (
  <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
    <div className="flex flex-wrap gap-4 text-base">
      <span>Контрагент: {contract.supplier_detail.name}</span>
      <span>Дата заключения: {formatDate(contract.contract_date)}</span>
      <span>Сумма: {formatByn(contract.total_cost)}</span>
      {contract.payment_terms && (
        <span>Условия оплаты: {contract.payment_terms}</span>
      )}
    </div>

    <div>
      <p className="mb-2 text-base font-medium">
        Спецификация (списание лимитов подразделений)
      </p>
      {contract.items.length === 0 ? (
        <p className="text-muted-foreground text-base">Нет строк</p>
      ) : (
        <Table className="text-base">
          <TableHeader>
            <TableRow>
              <TableHead>Наименование</TableHead>
              <TableHead>Подразделение</TableHead>
              <TableHead>Год</TableHead>
              <TableHead>Количество</TableHead>
              <TableHead>Сумма</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contract.items.map((line) => (
              <TableRow key={line.id}>
                <TableCell>{line.title ?? "—"}</TableCell>
                <TableCell>
                  {departmentByPlanShare?.get(line.plan_share) ?? "—"}
                </TableCell>
                <TableCell>{line.year}</TableCell>
                <TableCell>{line.contract_amount}</TableCell>
                <TableCell>{formatByn(line.contract_cost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>

    <div>
      <p className="mb-2 text-base font-medium">Квартальный план/факт</p>
      <QuarterlyFinanceTable contractId={contract.id} />
    </div>
  </div>
);
