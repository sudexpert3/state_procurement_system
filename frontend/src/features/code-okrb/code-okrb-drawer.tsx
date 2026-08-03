import type { OkrbProduct } from "@/shared/api/schema";
import type { CodeOkrbValues } from "./code-okrb.schema";

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

import { useCodeOkrbCreate } from "./model/use-code-okrb-create";
import { useCodeOkrbUpdate } from "./model/use-code-okrb-update";
import { CodeOkrbForm } from "./code-okrb-form";

type Props = {
  open: boolean;
  item: OkrbProduct | null;
  onClose: () => void;
};

export const CodeOkrbDrawer = ({ open, item, onClose }: Props) => {
  const isEdit = item !== null;
  const createCodeOkrb = useCodeOkrbCreate(onClose);
  const updateCodeOkrb = useCodeOkrbUpdate(onClose);
  const isPending = createCodeOkrb.isPending || updateCodeOkrb.isPending;

  const submit = (values: CodeOkrbValues) => {
    if (item) {
      updateCodeOkrb.updateCodeOkrb(item.id, values);
      return;
    }

    createCodeOkrb.createCodeOkrb(values);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isPending) {
      onClose();
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      direction="right"
      dismissible={!isPending}>
      <DrawerContent className="flex flex-col">
        <DrawerHeader>
          <DrawerTitle>
            {isEdit ? "Редактировать код ОКРБ" : "Добавить код ОКРБ"}
          </DrawerTitle>
        </DrawerHeader>

        <CodeOkrbForm item={item} onSubmit={submit} disabled={isPending} />

        <DrawerFooter>
          <Button type="submit" form="code-okrb-form" disabled={isPending}>
            {isPending && <Loader2Icon size={16} className="animate-spin" />}
            {isEdit ? "Сохранить" : "Добавить"}
          </Button>
          <DrawerClose asChild>
            <Button variant="destructive" disabled={isPending}>
              Отмена
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
