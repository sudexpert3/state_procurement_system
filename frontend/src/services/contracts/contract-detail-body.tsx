import type { Contract } from "@/shared/api/schema";

import { useMemo } from "react";

import { useCurrentUser } from "@/services/auth";
import { rqClient } from "@/shared/api/instance";
import { DetailField } from "@/shared/components/detail-field";
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

import { EditablePaymentTermsField } from "./editable-payment-terms-field";
import { QuarterlyFinanceTable } from "./quarterly-finance-table";

/** Экономический код (внешний, goszakupki.by) и код ЭКР (внутренний классификатор ГКСЭ) статьи бюджета */
export type EconomicInfo = { economicCode: string; internalEkrCode: string };

type Props = {
  contract: Contract;
};

/**
 * Содержимое карточки договора (контрагент, спецификация, квартальный
 * план/факт) — переиспользуется и в Drawer'е реестра договоров
 * (`features/contracts/contract-detail.tsx`), и на карточке позиции плана
 * (таб «Договоры», см. CurrentStatus.md) — чтобы не дублировать разметку
 * между двумя местами, где показывается один и тот же договор.
 */
export const ContractDetailBody = ({ contract }: Props) => {
  // Прямое редактирование условий оплаты — доступно только этим двум ролям,
  // см. core/choices.py (описание прав FINANCIER) и тот же принцип проверки
  // роли, что в info-tab.tsx (canEditDirectly).
  const { data: currentUser } = useCurrentUser();
  const canEditPaymentTerms =
    currentUser?.role === "ADMIN_MAIN" || currentUser?.role === "FINANCIER";

  // Contract.buyer — только id, без денормализованного имени (в отличие от
  // supplier_detail/procurement_method_detail_info, которые бэкенд уже
  // отдаёт вложенными объектами) — резолвим именем из общего справочника
  // закупщиков. Без фильтра is_active — иначе у договора, за которым
  // закреплён уже деактивированный закупщик, имя не найдётся.
  const buyersQuery = rqClient.useQuery("get", "/api/buyers/");
  const buyerName = buyersQuery.data?.find(
    (buyer) => buyer.id === contract.buyer,
  )?.shot_name;

  // Основной договор (для Доп. соглашений) — тоже только id, резолвим номер
  // отдельным point-запросом (дешевле, чем тянуть весь реестр ради одного
  // поля, которое заполнено у меньшинства договоров).
  const parentContractQuery = rqClient.useQuery(
    "get",
    "/api/contracts/{id}/",
    { params: { path: { id: contract.parent_contract ?? 0 } } },
    { enabled: contract.parent_contract != null },
  );

  // ContractQuarterlyFinance хранит только id строки спецификации
  // (contract_item), без экономического кода/ЭКР напрямую — достаём их из
  // уже денормализованных полей самой строки (`ContractItem.economic_class_detail`/
  // `.internal_economic_class_detail`, бэкенд добавил 2026-11-18).
  const economicInfoByContractItem = useMemo(() => {
    const map = new Map<number, EconomicInfo>();
    contract.items.forEach((item) => {
      const economicCode = item.economic_class_detail?.code_api;
      const internalEkrCode = item.internal_economic_class_detail?.code;
      if (economicCode && internalEkrCode) {
        map.set(item.id, { economicCode, internalEkrCode });
      }
    });
    return map;
  }, [contract.items]);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
      <div className="flex flex-wrap gap-4 text-base">
        <span>
          Контрагент:{" "}
          <span className="font-bold">{contract.supplier_detail.name}</span>
        </span>
        <span>
          Дата заключения:{" "}
          <span className="font-bold">
            {formatDate(contract.contract_date)}
          </span>
        </span>
        <span>
          Сумма:{" "}
          <span className="font-bold">{formatByn(contract.total_cost)}</span>
        </span>
        <EditablePaymentTermsField
          contractId={contract.id}
          paymentTerms={contract.payment_terms ?? null}
          canEdit={canEditPaymentTerms}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
        <DetailField
          label="Плановая дата исполнения"
          value={formatDate(contract.planned_delivery_date)}
        />
        <DetailField label="Закупщик" value={buyerName} />
        <DetailField
          label="Вид процедуры закупки"
          value={contract.procurement_method_detail_info?.name}
        />
        <DetailField
          label="Регистрация в территориальном казначействе"
          value={contract.is_registered_in_treasury ? "Да" : "Нет"}
        />
        <DetailField
          label="Вид строительных работ / объект строительства"
          value={contract.construction_type}
        />
        <DetailField
          label="Пункт перечня плана основных средств"
          value={contract.fixed_assets_plan_item}
        />
        <DetailField
          label="Основной договор (для Доп. соглашений)"
          value={parentContractQuery.data?.number}
        />
        <DetailField
          label="Примечание / дополнительная информация"
          value={contract.notice}
          className="col-span-2 md:col-span-3"
        />
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
                <TableHead className="w-48 whitespace-normal">
                  Наименование
                </TableHead>
                <TableHead>Экономический код</TableHead>
                <TableHead>Код ЭКР внутренний</TableHead>
                <TableHead>Подразделение</TableHead>
                <TableHead>Год</TableHead>
                <TableHead>Количество</TableHead>
                <TableHead>Сумма</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contract.items.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="w-48 max-w-48 break-words whitespace-normal">
                    {line.title ?? "—"}
                  </TableCell>
                  <TableCell>
                    {line.economic_class_detail?.code_api ?? "—"}
                  </TableCell>
                  <TableCell>
                    {line.internal_economic_class_detail?.code ?? "—"}
                  </TableCell>
                  <TableCell>
                    {line.department_detail?.short_name ?? "—"}
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
        <QuarterlyFinanceTable
          contractId={contract.id}
          economicInfoByContractItem={economicInfoByContractItem}
        />
      </div>
    </div>
  );
};
