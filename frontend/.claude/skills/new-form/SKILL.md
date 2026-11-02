---
name: new-form
description: Создаёт секцию формы с Zod-схемой и shadcn-полями (React Hook Form). Вызывай когда нужно добавить новый блок/секцию формы.
disable-model-invocation: true
---

Создай новую секцию формы по аргументу: $ARGUMENTS

Формат аргумента: `<имя-секции> в <путь-к-feature>` (например: `supplier-info в src/features/plan-items/create`)

## Шаги

1. **Создай Zod-схему** рядом с фичей (или расширь существующую `schema.ts`):

   ```ts
   import { z } from "zod";

   export const <name>Schema = z.object({
     // поля — используй z.coerce.number(), z.coerce.date() для инпутов
     // сообщения об ошибках — на русском языке
   });

   export type <Name>Values = z.infer<typeof <name>Schema>;
   ```

2. **Создай компонент секции** в папке `form/` фичи:

   ```tsx
   import { useFormContext } from "react-hook-form";
   import { InputField } from "@/shared/ui/form/input-field";
   import { ComboboxField } from "@/shared/ui/form/combobox-field";
   // другие поля из @/shared/ui/form/

   export function <Name>Section() {
     const form = useFormContext();
     return (
       <div className="space-y-4">
         {/* поля */}
       </div>
     );
   }
   ```

3. **Используй готовые поля** из `@/shared/ui/form/`:
   - `InputField` — текстовый инпут
   - `ComboboxField` — выпадающий список с поиском
   - `MultipleComboboxField` — множественный выбор
   - `TextAreaField` — textarea
   - Если нужного поля нет — создай по образцу существующих в `src/shared/ui/form/`

4. **Правила:**
   - `useFormContext()` вместо `useForm()` внутри секций (форма инициализируется снаружи)
   - `z.coerce.number()` для числовых инпутов, `z.coerce.date()` для дат
   - Все placeholder-ы и сообщения об ошибках — на русском

5. Сообщи где подключить секцию к родительской форме.
