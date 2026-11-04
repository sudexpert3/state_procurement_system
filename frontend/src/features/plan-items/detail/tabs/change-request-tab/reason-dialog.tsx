import { useState } from "react";

import { Loader2Icon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Textarea } from "@/shared/components/ui/textarea";

type Props = {
  open: boolean;
  title: string;
  description: string;
  required?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
};

export const ReasonDialog = ({
  open,
  title,
  description,
  required = false,
  onOpenChange,
  onConfirm,
  isPending = false,
}: Props) => {
  const [reason, setReason] = useState("");

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason("");
        onOpenChange(next);
      }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <Field>
          <FieldLabel htmlFor="change-request-reason">Обоснование</FieldLabel>
          <Textarea
            id="change-request-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending || (required && reason.trim().length === 0)}
            onClick={(e) => {
              e.preventDefault();
              onConfirm(reason.trim());
            }}>
            {isPending && <Loader2Icon size={14} className="animate-spin" />}
            Создать заявку
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
