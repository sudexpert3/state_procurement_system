import type { ContractInfoValues } from "@/features/procurements/create/schema";
import type { ContractItem } from "./contract.schema";

import { useCallback, useMemo, useState } from "react";

import { useFormContext, useWatch } from "react-hook-form";

import { createColumns } from "@/features/procurements/create/form/contract-section/columns";
import { DataTable } from "@/shared/ui/data-table/data-table";
import { InputField } from "@/shared/ui/form/input-field";
import { Button } from "@/shared/ui/kit/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/kit/card";
import { Separator } from "@/shared/ui/kit/separator";

import { ContractCard } from "./contract-card";
import { ContractDrawer } from "./contract-drawer";

export const ContractSection = () => {
  const { control, getValues, setValue } = useFormContext<ContractInfoValues>();

  const [contracts, setContracts] = useState<ContractItem[]>(
    () => getValues("contracts") ?? [],
  );

  const currentPlanBalance = useWatch({ control, name: "currentPlanBalance" });

  const syncContracts = useCallback(
    (next: ContractItem[]) => {
      setContracts(next);
      setValue("contracts", next, { shouldValidate: true, shouldDirty: true });
    },
    [setValue],
  );

  const [selectedId, setSelectedId] = useState<number | null>(
    () => getValues("contracts")?.at(-1)?.id ?? null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContractItem | null>(null);

  const selectedContract = contracts.find((c) => c.id === selectedId) ?? null;

  const onView = useCallback((row: ContractItem) => {
    setSelectedId(row.id);
  }, []);

  const onEdit = useCallback((row: ContractItem) => {
    setEditingItem(row);
    setDrawerOpen(true);
  }, []);

  const onDelete = useCallback(
    (id: number) => {
      const next = contracts.filter((c) => c.id !== id);
      syncContracts(next);

      if (selectedId === id) {
        setSelectedId(next.at(-1)?.id ?? null);
      }
    },
    [contracts, syncContracts, selectedId],
  );

  const handleAdd = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  const handleSubmitContract = (contract: ContractItem) => {
    if (editingItem) {
      syncContracts(
        contracts.map((c) =>
          c.id === editingItem.id ? { ...contract, id: editingItem.id } : c,
        ),
      );
      return;
    }

    const nextId = contracts.reduce((max, c) => Math.max(max, c.id), 0) + 1;

    const created = { ...contract, id: nextId };
    syncContracts([...contracts, created]);
    setSelectedId(nextId);
  };

  const columns = useMemo(
    () => createColumns(onView, onEdit, onDelete),
    [onView, onEdit, onDelete],
  );

  return (
    <div className="w-full pb-4">
      <Card className="w-full ring-0">
        <CardHeader className="px-2">
          <CardTitle className="text-lg font-semibold tracking-wide uppercase">
            Параметры плана
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
          <ContractCard
            contract={selectedContract}
            currentPlanBalance={currentPlanBalance ?? 0}
          />
        </CardContent>
      </Card>
      <div className="flex-1 space-y-4">
        <Button type="button" onClick={handleAdd}>
          Добавить договор
        </Button>
        <DataTable data={contracts} columns={columns} />
      </div>
      <ContractDrawer
        open={drawerOpen}
        item={editingItem}
        currentPlanBalance={currentPlanBalance ?? 0}
        onClose={() => {
          setDrawerOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleSubmitContract}
      />
    </div>
  );
};
