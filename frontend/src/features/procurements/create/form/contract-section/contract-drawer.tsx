import type { Supplier } from "@/shared/api/schema";

import { type FormEvent, useMemo, useRef } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm } from "react-hook-form";

import { DatePickerField } from "@/shared/ui/form/date-picker-field";
import { InputField } from "@/shared/ui/form/input-field";
import { TextAreaField } from "@/shared/ui/form/text-area-field";
import { Button } from "@/shared/ui/kit/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/kit/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/ui/kit/combobox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/ui/kit/drawer";
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

import { contractStatus } from "../../config";

import {
  type ContractItem,
  type ContractItemInput,
  makeContractItemSchema,
} from "./contract.schema";
import { EditableTable } from "./editable-table";

// TODO: заменить на список поставщиков из API
const suppliersMock = [
  { id: "101", value: "Поставщик 101" },
  { id: "102", value: "Поставщик 102" },
  { id: "103", value: "Поставщик 103" },
];

type Props = {
  open: boolean;
  item: ContractItem | null;
  // Сумма текущего плана — лимит для суммы договора
  currentPlanBalance: number;
  onClose: () => void;
  onSubmit: (contract: ContractItem) => void;
};

const emptyContract: ContractItemInput = {
  id: 0,
  contractNumber: "",
  contractSum: 0,
  supplierId: "",
  contractDate: new Date(),
  contractTerms: "",
  contractNotes: "",
  contractStatus: contractStatus.DEFAULT,
  constructionType: "",
  fixedAssetsPlanItem: "",
  isRegisteredInTreasury: false,
  parentContractId: null,
  plannedDeliveryDate: null,
  procurementMethodDetailId: 0,
  buyerId: 0,
  buyer: { id: 0, fullName: "", shortName: "", isActive: true },
  quarterDistribution: [],
};

export const ContractDrawer = ({
  open,
  item,
  currentPlanBalance,
  onClose,
  onSubmit,
}: Props) => {
  const isEdit = item !== null;
  const portalContainerRef = useRef<HTMLDivElement | null>(null);

  const resolver = useMemo(
    () => zodResolver(makeContractItemSchema(currentPlanBalance)),
    [currentPlanBalance],
  );

  const methods = useForm<ContractItemInput, unknown, ContractItem>({
    resolver,
    values: item ?? emptyContract,
  });

  const { control, handleSubmit } = methods;

  const handleContractSubmit = handleSubmit((values) => {
    onSubmit(values);
    onClose();
  });

  const submit = (e: FormEvent) => {
    e.stopPropagation();
    void handleContractSubmit(e);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => !v && onClose()}
      direction="right"
      dismissible={false}>
      <DrawerContent
        className="data-[vaul-drawer-direction=right]sm:w-1/3data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:sm:max-w-svh"
        ref={portalContainerRef}>
        <DrawerHeader>
          <DrawerTitle>
            {isEdit ? "Редактирование договора" : "Добавление договора"}
          </DrawerTitle>
        </DrawerHeader>

        <FormProvider {...methods}>
          <form
            id="contract-form"
            onSubmit={submit}
            className="no-scrollbar overflow-y-auto px-4">
            <Card className="w-full px-0 ring-0">
              <CardHeader className="px-0">
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

                {/* <ComboboxField
                  control={control}
                  name="supplierId"
                  label="Поставщик"
                  items={suppliersMock}
                  placeholder="Выберите поставщика"
                  renderItemValue={(item) => item.value}
                /> */}
                <Controller
                  name="supplierId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Поставщик</FieldLabel>
                      <Combobox
                        onValueChange={(val: Supplier | null) =>
                          field.onChange(val?.id ?? null)
                        }
                        //TODO : исправить отображение поставщика
                        itemToStringLabel={(val) => (val ? val.name : "")}>
                        <ComboboxInput
                          placeholder="Выберите поставщика"
                          showClear
                          aria-invalid={fieldState.invalid}
                        />
                        <ComboboxContent portalContainer={portalContainerRef}>
                          <ComboboxList>
                            {suppliersMock.map((item) => (
                              <ComboboxItem key={item.id} value={item}>
                                {item.value}
                              </ComboboxItem>
                            ))}
                          </ComboboxList>
                          <ComboboxEmpty>Ничего не найдено</ComboboxEmpty>
                        </ComboboxContent>
                      </Combobox>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
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
                        <SelectTrigger aria-invalid={fieldState.invalid}>
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

            <Card className="w-full px-0 ring-0">
              <CardHeader className="px-0">
                <CardTitle className="text-lg font-semibold tracking-wide uppercase">
                  Объёмы финансирования
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="space-y-4 px-2">
                <InputField
                  control={control}
                  name="contractSum"
                  label="Сумма договора (BYN)"
                  placeholder="0.00"
                  type="number"
                  required
                />
              </CardContent>
            </Card>

            <EditableTable />
          </form>
        </FormProvider>

        <DrawerFooter>
          <Button type="submit" form="contract-form">
            {isEdit ? "Сохранить" : "Добавить"}
          </Button>
          <DrawerClose asChild>
            <Button variant="destructive" className="w-full" onClick={onClose}>
              Отмена
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
