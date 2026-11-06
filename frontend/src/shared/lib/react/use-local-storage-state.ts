import { useCallback, useState } from "react";

type Updater<T> = T | ((prev: T) => T);

const readStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw !== null ? (JSON.parse(raw) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
};

/**
 * Как useState, но переживает размонтирование компонента (переход на другую
 * страницу и обратно) — значение хранится в localStorage. `key === null`
 * отключает персист (ведёт себя как обычный useState) — удобно, когда ключ
 * зависит от пропсов и персист нужен не всегда.
 */
export const useLocalStorageState = <T>(
  key: string | null,
  defaultValue: T,
) => {
  const [value, setValue] = useState<T>(() =>
    key ? readStorage(key, defaultValue) : defaultValue,
  );

  const setPersistedValue = useCallback(
    (next: Updater<T>) => {
      setValue((prev) => {
        const resolved = next instanceof Function ? next(prev) : next;
        if (key) {
          try {
            window.localStorage.setItem(key, JSON.stringify(resolved));
          } catch {
            // localStorage недоступен (приватный режим, квота) — не блокируем UI
          }
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, setPersistedValue] as const;
};
