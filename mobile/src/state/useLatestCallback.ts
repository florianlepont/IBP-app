import { useCallback, useLayoutEffect, useMemo, useRef } from "react"

/**
 * Stable-identity callbacks (phase 01.9, D-01).
 *
 * The latest implementation is stored in a ref that is updated in
 * useLayoutEffect, not useEffect (W1): React runs every layout effect of a
 * commit before any passive effect, so a child's useEffect in the same commit
 * already calls the new implementation. With useEffect, child effects would run
 * first and see the previous one.
 */
export function useLatestCallback<A extends unknown[], R>(
  fn: (...args: A) => R,
): (...args: A) => R {
  const ref = useRef(fn)
  useLayoutEffect(() => {
    ref.current = fn
  })
  return useCallback((...args: A) => ref.current(...args), [])
}

type ActionMap = Record<string, (...args: never[]) => unknown>

function sameKeys(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((key) => set.has(key))
}

/**
 * Returns an object created once whose members forward to the latest
 * implementation of the same key. Its identity never changes, so it can sit
 * in a memoised context value without invalidating it.
 *
 * The key set must be fixed: the object has the keys of the first render. A
 * key added or removed later is reported with console.error in development and
 * is otherwise ignored (an added key is not reachable, a removed key forwards
 * to undefined).
 */
export function useStableActions<T extends ActionMap>(actions: T): T {
  const ref = useRef(actions)
  const initialKeysRef = useRef<string[] | null>(null)
  if (initialKeysRef.current === null) {
    initialKeysRef.current = Object.keys(actions)
  }

  useLayoutEffect(() => {
    ref.current = actions
    if (__DEV__) {
      const initialKeys = initialKeysRef.current ?? []
      const currentKeys = Object.keys(actions)
      if (!sameKeys(initialKeys, currentKeys)) {
        console.error("useStableActions: the action keys changed after the first render.", {
          initial: initialKeys,
          current: currentKeys,
        })
      }
    }
  })

  return useMemo(() => {
    const stable = {} as Record<string, (...args: never[]) => unknown>
    for (const key of initialKeysRef.current ?? []) {
      stable[key] = (...args: never[]) => {
        const current = ref.current[key]
        return current(...args)
      }
    }
    return stable as T
  }, [])
}
