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
  /**
   * id PlanShare (= ContractItem.plan_share) → короткое имя подразделения.
   * `ContractItem` отдаёт только id PlanShare, без названия подразделения
   * (бэкенд их не денормализует) — карта строится там, где эти PlanShare уже
   * загружены целиком (карточка позиции плана, см. `contracts-tab.tsx`).
   * В реестре договоров (`features/contracts/contract-detail.tsx`) такой
   * карты нет — колонка там покажет «—».
   */
  departmentByPlanShare?: Map<number, string>;
  /**
   * id PlanShare → экономический код и код ЭКР внутренний той статьи
   * бюджета, с которой списывается строка спецификации. Строится там же,
   * где departmentByPlanShare (карточка позиции плана) — в реестре
   * договоров такой карты нет, колонки покажут «—».
   */
  economicInfoByPlanShare?: Map<number, EconomicInfo>;
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
  economicInfoByPlanShare,
}: Props) => {
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
  // (contract_item), без экономического кода/ЭКР напрямую — достаём их через
  // plan_share этой строки, раз карта экономики уже построена по позиции
  // плана (economicInfoByPlanShare).
  const economicInfoByContractItem = useMemo(() => {
    const map = new Map<number, EconomicInfo>();
    if (!economicInfoByPlanShare) return map;
    contract.items.forEach((item) => {
      const info = economicInfoByPlanShare.get(item.plan_share);
      if (info) map.set(item.id, info);
    });
    return map;
  }, [contract.items, economicInfoByPlanShare]);

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
              {contract.items.map((line) => {
                const economicInfo = economicInfoByPlanShare?.get(
                  line.plan_share,
                );
                return (
                  <TableRow key={line.id}>
                    <TableCell className="w-48 max-w-48 break-words whitespace-normal">
                      {line.title ?? "—"}
                    </TableCell>
                    <TableCell>{economicInfo?.economicCode ?? "—"}</TableCell>
                    <TableCell>
                      {economicInfo?.internalEkrCode ?? "—"}
                    </TableCell>
                    <TableCell>
                      {departmentByPlanShare?.get(line.plan_share) ?? "—"}
                    </TableCell>
                    <TableCell>{line.year}</TableCell>
                    <TableCell>{line.contract_amount}</TableCell>
                    <TableCell>{formatByn(line.contract_cost)}</TableCell>
                  </TableRow>
                );
              })}
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
