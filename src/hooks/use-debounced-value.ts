import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value`, updated only after `delay` ms
 * of inactivity. Useful for search inputs and expensive derivations.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
