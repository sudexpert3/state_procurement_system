import type { Buyer } from "@/shared/api/schema";
import type { BuyerValues } from "./buyer.schema";

import { Loader2Icon } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/components/ui/drawer";

import { useBuyerCreate } from "./model/use-buyer-create";
import { useBuyerUpdate } from "./model/use-buyer-update";
import { BuyerForm } from "./buyer-form";

type Props = {
  open: boolean;
  item: Buyer | null;
  onClose: () => void;
};

export const BuyerDrawer = ({ open, item, onClose }: Props) => {
  const isEdit = item !== null;
  const createBuyer = useBuyerCreate(onClose);
  const updateBuyer = useBuyerUpdate(onClose);
  const isPending = isEdit ? updateBuyer.isPending : createBuyer.isPending;

  const submit = (values: BuyerValues) => {
    if (item) {
      updateBuyer.updateBuyer(item.id, values);
      return;
    }

    createBuyer.createBuyer(values);
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()} direction="right">
      <DrawerContent className="flex flex-col">
        <DrawerHeader>
          <DrawerTitle>
            {isEdit ? "Редактировать закупщика" : "Добавить закупщика"}
          </DrawerTitle>
        </DrawerHeader>
        <BuyerForm item={item} onSubmit={submit} />
        <DrawerFooter>
          <Button type="submit" form="buyer-form" disabled={isPending}>
            {isPending && <Loader2Icon size={16} className="animate-spin" />}
            {isEdit ? "Сохранить" : "Добавить"}
          </Button>
          <DrawerClose asChild>
            <Button
              variant="destructive"
              onClick={onClose}
              disabled={isPending}>
              Отмена
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
