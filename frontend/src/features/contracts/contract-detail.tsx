import type { Contract } from "@/shared/api/schema";

import { useState } from "react";

import { PencilIcon } from "lucide-react";

import { ContractDetailBody } from "@/services/contracts";
import { Button } from "@/shared/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { cn } from "@/shared/lib/utils";

import { ContractForm } from "./contract-form";

type Props = {
  item: Contract | null;
  /** Доступно только ролям ADMIN_MAIN/FINANCIER, см. core/choices.py (capability edit_contracts) */
  canEdit: boolean;
  onClose: () => void;
  /** Договор обновлён через форму — чтобы Drawer сразу показал новые данные, не дожидаясь перезагрузки списка */
  onUpdated: (contract: Contract) => void;
};

// Переключатель вид/редактирование вынесен в отдельный компонент и смонтирован
// с `key={item.id}` в родителе — так смена договора (например, пользователь
// открыл другую строку списка) надёжно сбрасывает режим редактирования назад
// на просмотр, без отдельного useEffect.
const ContractDetailContent = ({
  item,
  canEdit,
  onClose,
  onUpdated,
}: {
  item: Contract;
  canEdit: boolean;
  onClose: () => void;
  onUpdated: (contract: Contract) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <ContractForm
        item={item}
        onCancel={() => setIsEditing(false)}
        onSuccess={(updated) => {
          onUpdated(updated);
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <>
      <ContractDetailBody contract={item} />
      <DrawerFooter>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsEditing(true)}>
            <PencilIcon size={16} />
            Редактировать
          </Button>
        )}
        <DrawerClose asChild>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </DrawerClose>
      </DrawerFooter>
    </>
  );
};

export const ContractDetail = ({
  item,
  canEdit,
  onClose,
  onUpdated,
}: Props) => (
  <Drawer
    open={item !== null}
    onOpenChange={(v) => !v && onClose()}
    direction="right">
    <DrawerContent
      className={cn(
        "flex flex-col",
        "data-[vaul-drawer-direction=right]:w-[calc(100%-50px)]",
        "data-[vaul-drawer-direction=right]:sm:max-w-[calc(100%-50px)]",
      )}>
      <DrawerHeader>
        <DrawerTitle>Договор № {item?.number}</DrawerTitle>
      </DrawerHeader>

      {item && (
        <ContractDetailContent
          key={item.id}
          item={item}
          canEdit={canEdit}
          onClose={onClose}
          onUpdated={onUpdated}
        />
      )}
    </DrawerContent>
  </Drawer>
);
