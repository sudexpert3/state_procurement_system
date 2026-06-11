import type { ContractInfoValues } from "@/features/procurements/create/schema";

import { useState } from "react";

import { Controller, useFormContext } from "react-hook-form";

import { contractStatus } from "@/features/procurements/create/config";
import {
  columns,
  type ProcurementContract,
} from "@/features/procurements/create/form/contract-section/columns";
import { DataTable } from "@/shared/ui/data-table/data-table";
import { ComboboxField } from "@/shared/ui/form/combobox-field";
import { DatePickerField } from "@/shared/ui/form/date-picker-field";
import { InputField } from "@/shared/ui/form/input-field";
import { TextAreaField } from "@/shared/ui/form/text-area-field";
import { Button } from "@/shared/ui/kit/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/kit/card";
import { DrawerClose } from "@/shared/ui/kit/drawer";
import { Field, FieldError, FieldLabel } from "@/shared/ui/kit/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/kit/select";
import { Separator } from "@/shared/ui/kit/separator";

import { ContractDetails } from "./contract-details";

const suppliersMock = [
  { id: "1", value: "Поставщик 1", disabled: true },
  { id: "2", value: "Поставщик 2", disabled: true },
  { id: "3", value: "Поставщик 3", disabled: true },
];

const procurementContracts: ProcurementContract[] = [
  {
    id: 1,
    number: "PC-2025-001",
    total_cost: 12500000,
    supplier_id: 101,
    construction_type: "Новое строительство",
    contract_date: "2025-01-15",
    fixed_assets_plan_item: "ОС-001",
    is_registered_in_treasury: true,
    notice: "Основной договор",
    parent_contract_id: null,
    payment_terms: "50% предоплата, 50% после поставки",
    planned_delivery_date: "2025-06-30",
    procurement_method_detail_id: 1,
    buyerId: 1,
    buyerDetail: {
      id: 1,
      fullName: "АО Кыргызнефтегаз",
      shortName: "КНГ",
      isActive: true,
    },
  },
  {
    id: 2,
    number: "PC-2025-002",
    total_cost: 8700000,
    supplier_id: 102,
    construction_type: "Реконструкция",
    contract_date: "2025-02-01",
    fixed_assets_plan_item: "ОС-002",
    is_registered_in_treasury: true,
    notice: "",
    parent_contract_id: 1,
    payment_terms: "100% после выполнения работ",
    planned_delivery_date: "2025-08-15",
    procurement_method_detail_id: 2,
    buyerId: 2,
    buyerDetail: {
      id: 2,
      fullName: "ОсОО БишкекСтрой",
      shortName: "БС",
      isActive: true,
    },
  },
  {
    id: 3,
    number: "PC-2025-003",
    total_cost: 3500000,
    supplier_id: 103,
    construction_type: "Капитальный ремонт",
    contract_date: "2025-02-18",
    fixed_assets_plan_item: "ОС-003",
    is_registered_in_treasury: false,
    notice: "На согласовании",
    parent_contract_id: null,
    payment_terms: "30 дней отсрочки",
    planned_delivery_date: "2025-09-01",
    procurement_method_detail_id: 1,
    buyerId: 3,
    buyerDetail: {
      id: 3,
      fullName: "ЗАО ЭнергоСервис",
      shortName: "ЭС",
      isActive: true,
    },
  },
  {
    id: 4,
    number: "PC-2025-004",
    total_cost: 21500000,
    supplier_id: 104,
    construction_type: "Новое строительство",
    contract_date: "2025-03-05",
    fixed_assets_plan_item: "ОС-004",
    is_registered_in_treasury: true,
    notice: "Приоритетный объект",
    parent_contract_id: null,
    payment_terms: "20% аванс, остальное по этапам",
    planned_delivery_date: "2025-12-20",
    procurement_method_detail_id: 3,
    buyerId: 1,
    buyerDetail: {
      id: 1,
      fullName: "АО Кыргызнефтегаз",
      shortName: "КНГ",
      isActive: true,
    },
  },
  {
    id: 5,
    number: "PC-2025-005",
    total_cost: 6400000,
    supplier_id: 105,
    construction_type: "Модернизация",
    contract_date: "2025-03-20",
    fixed_assets_plan_item: "ОС-005",
    is_registered_in_treasury: false,
    notice: "",
    parent_contract_id: 2,
    payment_terms: "По факту поставки",
    planned_delivery_date: "2025-07-15",
    procurement_method_detail_id: 2,
    buyerId: 4,
    buyerDetail: {
      id: 4,
      fullName: "ОсОО ТехИнвест",
      shortName: "ТИ",
      isActive: true,
    },
  },
  {
    id: 6,
    number: "PC-2025-006",
    total_cost: 9800000,
    supplier_id: 106,
    construction_type: "Реконструкция",
    contract_date: "2025-04-02",
    fixed_assets_plan_item: "ОС-006",
    is_registered_in_treasury: true,
    notice: "Дополнительное соглашение",
    parent_contract_id: 4,
    payment_terms: "50% / 50%",
    planned_delivery_date: "2025-10-10",
    procurement_method_detail_id: 4,
    buyerId: 2,
    buyerDetail: {
      id: 2,
      fullName: "ОсОО БишкекСтрой",
      shortName: "БС",
      isActive: true,
    },
  },
  {
    id: 7,
    number: "PC-2025-007",
    total_cost: 15400000,
    supplier_id: 107,
    construction_type: "Новое строительство",
    contract_date: "2025-04-18",
    fixed_assets_plan_item: "ОС-007",
    is_registered_in_treasury: true,
    notice: "",
    parent_contract_id: null,
    payment_terms: "Поэтапная оплата",
    planned_delivery_date: "2025-11-01",
    procurement_method_detail_id: 1,
    buyerId: 5,
    buyerDetail: {
      id: 5,
      fullName: "ОАО Водоканал",
      shortName: "ВК",
      isActive: true,
    },
  },
  {
    id: 8,
    number: "PC-2025-008",
    total_cost: 2800000,
    supplier_id: 108,
    construction_type: "Капитальный ремонт",
    contract_date: "2025-05-01",
    fixed_assets_plan_item: "ОС-008",
    is_registered_in_treasury: false,
    notice: "Требуется корректировка",
    parent_contract_id: null,
    payment_terms: "100% после приемки",
    planned_delivery_date: "2025-06-25",
    procurement_method_detail_id: 5,
    buyerId: 3,
    buyerDetail: {
      id: 3,
      fullName: "ЗАО ЭнергоСервис",
      shortName: "ЭС",
      isActive: true,
    },
  },
  {
    id: 9,
    number: "PC-2025-009",
    total_cost: 7200000,
    supplier_id: 109,
    construction_type: "Модернизация",
    contract_date: "2025-05-12",
    fixed_assets_plan_item: "ОС-009",
    is_registered_in_treasury: true,
    notice: "",
    parent_contract_id: 7,
    payment_terms: "40% аванс",
    planned_delivery_date: "2025-09-30",
    procurement_method_detail_id: 2,
    buyerId: 4,
    buyerDetail: {
      id: 4,
      fullName: "ОсОО ТехИнвест",
      shortName: "ТИ",
      isActive: true,
    },
  },
  {
    id: 10,
    number: "PC-2025-010",
    total_cost: 18900000,
    supplier_id: 110,
    construction_type: "Новое строительство",
    contract_date: "2025-06-01",
    fixed_assets_plan_item: "ОС-010",
    is_registered_in_treasury: true,
    notice: "Крупный инфраструктурный проект",
    parent_contract_id: null,
    payment_terms: "По графику финансирования",
    planned_delivery_date: "2026-02-15",
    procurement_method_detail_id: 3,
    buyerId: 5,
    buyerDetail: {
      id: 5,
      fullName: "ОАО Водоканал",
      shortName: "ВК",
      isActive: true,
    },
  },
];

export const ContractSection = () => {
  const { control } = useFormContext<ContractInfoValues>();
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full pb-4">
      <div className="flex gap-10">
        <Card className="w-full ring-0">
          <CardHeader className="px-2">
            <CardTitle className="text-lg font-semibold tracking-wide uppercase">
              Детали договора
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4 px-2">
            <InputField
              control={control}
              name="contractNumber"
              label="№ договора"
              placeholder="52311"
              required
            />
            <DatePickerField
              control={control}
              label="Дата договора"
              name="contractDate"
              placeholder="Выберите дату"
            />
            <ComboboxField
              control={control}
              name="supplierId"
              label="Поставщик"
              items={suppliersMock}
              placeholder="Выберите поставщика"
              renderItemValue={(item) => item.value}
            />
            <TextAreaField
              control={control}
              name="contractTerms"
              label="Условия оплаты/поставки"
              placeholder="условия договора"
            />
            <TextAreaField
              control={control}
              name="contractNotes"
              label="Примечания по договору"
              placeholder="Примечания по договору"
            />
            <Controller
              control={control}
              name="contractStatus"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Статус договора</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}>
                    <SelectTrigger
                      id="rhf-select-typeOfGoods"
                      aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Выберите тип" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value={contractStatus.ACCEPTED}>
                          Принято к оплате ТК
                        </SelectItem>
                        <SelectItem value={contractStatus.CANCELLED}>
                          Не принято к оплате ТК
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </CardContent>
        </Card>
        <div className="w-full">
          <Card className="w-full ring-0">
            <CardHeader className="px-2">
              <CardTitle className="text-lg font-semibold tracking-wide uppercase">
                Объемы финансирования
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-4 px-2">
              <InputField
                control={control}
                name="currentPlanBalance"
                label="Текущая сумма плана (BYN)"
                placeholder="0.00"
                type="number"
                required
              />
              <InputField
                control={control}
                name="contractSum"
                label="Сумма договора (BYN)" //!Сумма договора не должна превышать сумму плана
                placeholder="0.00"
                type="number"
                required
              />
            </CardContent>
          </Card>
          <Card className="w-full ring-0">
            <CardHeader className="px-2">
              <CardTitle className="text-lg font-semibold tracking-wide uppercase">
                Контроль исполнения
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-4 px-2">
              <InputField
                control={control}
                name="totalLiabilities"
                label="Сумма принятых обязательств"
                placeholder="0.00"
                type="number"
                required
              />
              <InputField
                control={control}
                name="variance"
                label="Отклонение (план/договор)"
                placeholder="0.00"
                disabled
              />
              <InputField
                control={control}
                name="remainingBalance"
                label="Остаток от договора"
                placeholder="0.00"
                disabled
              />
            </CardContent>
          </Card>
        </div>
      </div>
      <Button
        type="button"
        onClick={() => {
          setOpen(true);
        }}>
        Добавить договор
      </Button>

      <ContractDetails
        title={<span>Добавление договора</span>}
        open={open}
        setOpen={setOpen}
        footer={
          <>
            <Button className="">Добавить</Button>
            <DrawerClose asChild>
              <Button variant="destructive" className="w-full">
                Отмена
              </Button>
            </DrawerClose>
          </>
        }
      />
      <DataTable data={procurementContracts} columns={columns} />
    </div>
  );
};
