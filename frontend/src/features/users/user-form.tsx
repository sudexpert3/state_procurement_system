import type { ApiSchemas, Buyer, User } from "@/shared/api/schema";

import { useMemo, useRef } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { Button } from "@/shared/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/components/ui/combobox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

import { ROLE_OPTIONS, ROLES_WITH_BUYER } from "./role-labels";
import {
  createUserSchema,
  type UserFormInput,
  type UserFormValues,
} from "./users.schema";

type Props = {
  open: boolean;
  item: User | null;
  buyers: Buyer[];
  onClose: () => void;
  onSuccess: () => void;
};

const defaultValues: UserFormInput = {
  username: "",
  first_name: "",
  last_name: "",
  email: "",
  is_active: true,
  role: "PURCHASING_SPECIALIST",
  buyer: null,
  password: "",
};

export const UserForm = ({ open, item, buyers, onClose, onSuccess }: Props) => {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const isEdit = item !== null;

  const createMutation = rqClient.useMutation("post", "/api/users/");
  const updateMutation = rqClient.useMutation("patch", "/api/users/{id}/");
  const isPending = createMutation.isPending || updateMutation.isPending;

  const formValues: UserFormInput = item
    ? {
        username: item.username,
        first_name: item.first_name ?? "",
        last_name: item.last_name ?? "",
        email: item.email ?? "",
        is_active: item.is_active ?? true,
        role: item.role,
        buyer: item.buyer ?? null,
        password: "",
      }
    : defaultValues;

  const schema = useMemo(() => createUserSchema(isEdit), [isEdit]);

  const { control, handleSubmit } = useForm<
    UserFormInput,
    unknown,
    UserFormValues
  >({
    resolver: zodResolver(schema),
    values: formValues,
  });

  const role = useWatch({ control, name: "role" });

  const handleSuccess = (message: string) => {
    toast.success(message);
    onClose();
    onSuccess();
  };

  const submit = handleSubmit((values) => {
    const body = {
      username: values.username,
      first_name: values.first_name,
      last_name: values.last_name,
      email: values.email,
      is_active: values.is_active,
      role: values.role,
      buyer: values.buyer,
      ...(values.password ? { password: values.password } : {}),
    };

    if (item) {
      updateMutation.mutate(
        { params: { path: { id: item.id } }, body },
        {
          onSuccess: () => handleSuccess("Пользователь обновлён"),
          onError: (error) =>
            handleHttpError(error, "Не удалось сохранить пользователя", true),
        },
      );
    } else {
      createMutation.mutate(
        {
          // `User` в сгенерированной схеме требует readonly id/role_display/...
          // на вход — DRF их игнорирует, тот же приём, что и в остальных
          // create-мутациях проекта (см. CurrentStatus.md).
          body: body as unknown as ApiSchemas["User"],
        },
        {
          onSuccess: () => handleSuccess("Пользователь создан"),
          onError: (error) =>
            handleHttpError(error, "Не удалось создать пользователя", true),
        },
      );
    }
  });

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()} direction="right">
      <DrawerContent className="flex flex-col" ref={portalContainerRef}>
        <DrawerHeader>
          <DrawerTitle>
            {isEdit ? "Редактировать пользователя" : "Новый пользователь"}
          </DrawerTitle>
        </DrawerHeader>

        <form
          id="user-form"
          onSubmit={submit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
          <Controller
            name="username"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-username">Логин</FieldLabel>
                <Input
                  id="field-username"
                  placeholder="ivanov"
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="last_name"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-last-name">Фамилия</FieldLabel>
                <Input id="field-last-name" {...field} />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="first_name"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-first-name">Имя</FieldLabel>
                <Input id="field-first-name" {...field} />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="email"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-email">Email</FieldLabel>
                <Input
                  id="field-email"
                  type="email"
                  placeholder="ivanov@example.com"
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="role"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Роль</FieldLabel>
                <Select
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}>
                  <SelectTrigger aria-invalid={fieldState.invalid}>
                    <SelectValue placeholder="Выберите роль" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="buyer"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Закупщик</FieldLabel>
                <Combobox
                  items={buyers}
                  value={
                    buyers.find((buyer) => buyer.id === field.value) ?? null
                  }
                  onValueChange={(buyer: Buyer | null) =>
                    field.onChange(buyer?.id ?? null)
                  }
                  itemToStringLabel={(buyer) => buyer?.shot_name ?? ""}
                  itemToStringValue={(buyer) =>
                    buyer ? String(buyer.id) : ""
                  }>
                  <ComboboxInput placeholder="Не привязан..." showClear />
                  <ComboboxContent portalContainer={portalContainerRef}>
                    <ComboboxEmpty>Закупщик не найден</ComboboxEmpty>
                    <ComboboxList>
                      {(buyer: Buyer) => (
                        <ComboboxItem key={buyer.id} value={buyer}>
                          {buyer.shot_name}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {!ROLES_WITH_BUYER.includes(role) && (
                  <FieldDescription>
                    Обычно заполняется только для ролей «Закупщик»/«Главный
                    закупщик»
                  </FieldDescription>
                )}
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="password"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="field-password">Пароль</FieldLabel>
                <Input
                  id="field-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={isEdit ? "Оставьте пустым, чтобы не менять" : ""}
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="is_active"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Статус</FieldLabel>
                <Select
                  name={field.name}
                  value={String(field.value)}
                  onValueChange={(val) => field.onChange(val === "true")}>
                  <SelectTrigger aria-invalid={fieldState.invalid}>
                    <SelectValue placeholder="Выберите статус" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      <SelectItem value="true">Активен</SelectItem>
                      <SelectItem value="false">Заблокирован</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </form>

        <DrawerFooter>
          <Button type="submit" form="user-form" disabled={isPending}>
            {isPending && <Loader2Icon size={16} className="animate-spin" />}
            {isEdit ? "Сохранить" : "Создать"}
          </Button>
          <DrawerClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Отмена
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
