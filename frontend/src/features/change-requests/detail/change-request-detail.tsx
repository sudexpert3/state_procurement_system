import type { ChangeRequest } from "@/services/change-requests";

import {
  CHANGE_REQUEST_KIND_LABELS,
  ChangeRequestActions,
} from "@/services/change-requests";
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
  item: ChangeRequest | null;
  onClose: () => void;
};

export const ChangeRequestDetail = ({ item, onClose }: Props) => (
  <Drawer
    open={item !== null}
    onOpenChange={(v) => !v && onClose()}
    direction="right">
    <DrawerContent className="flex flex-col sm:max-w-2xl">
      <DrawerHeader>
        <DrawerTitle>
          Заявка №{item?.id} — {item && CHANGE_REQUEST_KIND_LABELS[item.kind]}
        </DrawerTitle>
      </DrawerHeader>

      {item && (
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <ChangeRequestActions item={item} />
        </div>
      )}

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
