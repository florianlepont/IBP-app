import { createContext } from "react"

/**
 * Explorer tab reload signal (phase 01.9-18).
 *
 * Pressing the Explorer tab reloads the public map. The map state now lives in
 * the map route, which is mounted lazily: on the first press the tab listener
 * runs before the route exists. The signal keeps that request pending until
 * the route subscribes, so the first press still loads the map, exactly as
 * when the explorer lived at the top of the tree.
 */
export type PublicMapReloadSignal = {
  request: () => void
  subscribe: (listener: () => void) => () => void
}

export function createPublicMapReloadSignal(): PublicMapReloadSignal {
  let pending = false
  const listeners = new Set<() => void>()

  return {
    request() {
      if (listeners.size === 0) {
        pending = true
        return
      }
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      if (pending) {
        pending = false
        listener()
      }
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export const PublicMapReloadContext = createContext<PublicMapReloadSignal | null>(null)
