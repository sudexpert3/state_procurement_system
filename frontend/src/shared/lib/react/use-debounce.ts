import { startTransition, useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay: number) {
  const [debounceValue, setDebounceValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => setDebounceValue(value));
    }, delay);

    return clearTimeout(timer);
  }, [value, delay]);

  return debounceValue;
}
