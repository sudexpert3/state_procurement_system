# Zustand — best practices

## Actions внутри стора

```ts
interface Store {
  bears: number;
  increase: () => void;
  reset: () => void;
}

const useStore = create<Store>()((set) => ({
  bears: 0,
  increase: () => set((s) => ({ bears: s.bears + 1 })),
  reset: () => set({ bears: 0 }),
}));
```

## TypeScript: обязательный двойной вызов `create<T>()()`

```ts
// ✅ Правильно — с middleware
const useStore = create<State>()(
  devtools(persist((set) => ({ ... }), { name: 'my-store' }), { name: 'MyStore' })
)
// ❌ create<State>(...) — типы сломаются при middleware
```

## Selector-паттерны — избегать лишних ре-рендеров

```ts
// ❌ Плохо — новый объект на каждый рендер = всегда ре-рендер
const { nuts, honey } = useFoodStore();

// ✅ Атомарные селекторы
const nuts = useFoodStore((s) => s.nuts);
const honey = useFoodStore((s) => s.honey);

// ✅ useShallow — для нескольких полей сразу
import { useShallow } from "zustand/react/shallow";
const { nuts, honey } = useFoodStore(
  useShallow((s) => ({ nuts: s.nuts, honey: s.honey })),
);
```

## Slice pattern для большого стора

```ts
// bearSlice.ts
export interface BearSlice {
  bears: number;
  addBear: () => void;
}
export const createBearSlice = (set: any): BearSlice => ({
  bears: 0,
  addBear: () => set((s: BearSlice) => ({ bears: s.bears + 1 })),
});

// store.ts
export const useStore = create<BearSlice & FishSlice>()((...a) => ({
  ...createBearSlice(...a),
  ...createFishSlice(...a),
}));
```

## Что НЕ класть в глобальный стор

| Что                              | Где хранить                          |
| -------------------------------- | ------------------------------------ |
| Данные с сервера                 | `@tanstack/react-query`              |
| Состояние форм                   | React Hook Form                      |
| Локальный UI-state компонента    | `useState`                           |
| Производные/вычисляемые значения | Считать в компоненте или в селекторе |

## Когда Zustand, когда useState

- **useState/useReducer** — состояние одного компонента, локальная форма
- **Zustand** — состояние нескольких несвязанных компонентов, auth, UI-флаги (sidebar), фильтры таблиц
