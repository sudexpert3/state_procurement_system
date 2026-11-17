import type { Contract } from "@/shared/api/schema";

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

type Props = {
  item: Contract | null;
  onClose: () => void;
};

export const ContractDetail = ({ item, onClose }: Props) => (
  <Drawer
    open={item !== null}
    onOpenChange={(v) => !v && onClose()}
    direction="right">
    <DrawerContent className="flex flex-col sm:max-w-4xl">
      <DrawerHeader>
        <DrawerTitle>Договор № {item?.number}</DrawerTitle>
      </DrawerHeader>

      {item && <ContractDetailBody contract={item} />}

      <DrawerFooter>
        <DrawerClose asChild>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
);
