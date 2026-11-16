import { z } from "zod";

const ROLE_VALUES = [
  "ADMIN_MAIN",
  "MAIN_PURCHASER",
  "PURCHASING_SPECIALIST",
  "FINANCIER",
  "HEAD",
] as const;

/**
 * Пароль обязателен только при создании — при правке пустое поле значит
 * "не менять пароль" (так и задумано бэком, см. `CurrentStatus.md`, Этап 7,
 * задача фронту п.3: "в PATCH — опционален, без него пароль не меняется").
 */
export const createUserSchema = (isEdit: boolean) =>
  z.object({
    username: z.string().min(1, "Обязательное поле"),
    first_name: z.string(),
    last_name: z.string(),
    email: z.union([z.literal(""), z.email("Введите корректный email")]),
    is_active: z.boolean(),
    role: z.enum(ROLE_VALUES, { error: "Выберите роль" }),
    buyer: z.number().nullable(),
    password: isEdit
      ? z.union([z.literal(""), z.string().min(8, "Минимум 8 символов")])
      : z.string().min(8, "Минимум 8 символов"),
  });

export type UserFormInput = z.input<ReturnType<typeof createUserSchema>>;
export type UserFormValues = z.output<ReturnType<typeof createUserSchema>>;
