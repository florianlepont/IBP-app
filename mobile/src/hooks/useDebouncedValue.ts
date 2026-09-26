import { useEffect, useState } from "react"

/**
 * Returns `value` once it has stayed unchanged for `delayMs` (D-05: the map
 * waits about 400 ms after the last region change before loading). A change
 * within the delay restarts the timer; unmounting clears it.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
