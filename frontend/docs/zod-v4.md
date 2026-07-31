# Zod v4 — best practices

Проект использует Zod **v4**. API отличается от v3.

## Сообщения об ошибках: `error`, не `message`

```ts
// ✅ v4
z.string().min(1, { error: "Обязательное поле" });
z.coerce.number({ error: "Должно быть числом" });
z.string().min(1, "Обязательное поле"); // краткая форма тоже работает

// ❌ v3 — не использовать
z.string().min(1, { message: "..." });
```

## Deprecated API — не использовать в новом коде

| Deprecated                       | Замена                                        |
| -------------------------------- | --------------------------------------------- |
| `z.string().email()`             | `z.email()`                                   |
| `A.merge(B)`                     | `A.extend(B.shape)`                           |
| `z.nativeEnum(E)`                | `z.enum(E)` (принимает `as const` объекты)    |
| `z.setErrorMap()`                | `z.config({ error: ... })`                    |
| `err.format()` / `err.flatten()` | `z.treeifyError(err)` / `z.flattenError(err)` |

## Compose-паттерны

```ts
const Extended = Base.extend({ extra: z.string() });
const Merged = A.extend(B.shape); // вместо A.merge(B)
const Picked = Schema.pick({ name: true });
const Omitted = Schema.omit({ password: true });
const Partial = Schema.partial();
```

## coerce vs preprocess vs transform

```ts
// coerce — для строковых инпутов форм (правило проекта)
z.coerce.number({ error: "Должно быть числом" }).positive();
z.coerce.date({ error: "Введите дату" });

// preprocess — нестандартные случаи (пустая строка → undefined)
z.preprocess((val) => (val === "" ? undefined : val), z.string().optional());

// transform — меняет тип ПОСЛЕ валидации
z.string().transform((s) => s.trim().toLowerCase());
```

## Типы для React Hook Form

```ts
// z.input<T> — тип для defaultValues (то, что вводит пользователь)
// z.output<T> / z.infer<T> — тип для onSubmit (после coerce/transform)
type FormInput = z.input<typeof schema>;
type FormOutput = z.infer<typeof schema>;
```

## refine / superRefine

```ts
// Кросс-полевая валидация
const schema = z.object({ password: z.string(), confirm: z.string() })
  .refine(d => d.password === d.confirm, {
    error: "Пароли не совпадают",
    path: ["confirm"],
  });

// Несколько ошибок
.superRefine((d, ctx) => {
  if (d.end <= d.start) ctx.addIssue({ code: "custom", message: "...", path: ["end"] });
});
```
