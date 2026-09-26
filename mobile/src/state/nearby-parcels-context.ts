import { createContext, useContext } from "react"
import type { NearbyParcelsState } from "../hooks/useNearbyParcels"

/**
 * Nearby parcels (phase 01.9-18): the parcels around the device that the home
 * screen lists. They used to sit in the form context, so every form keystroke
 * re-rendered the home screen. They have their own narrow context, like the
 * access token: the value changes only when the parcels load, and `load` is
 * stable.
 */
export type NearbyParcelsContextValue = {
  state: NearbyParcelsState
  load: () => Promise<void>
}

export const NearbyParcelsContext = createContext<NearbyParcelsContextValue | null>(null)

export const NearbyParcelsProvider = NearbyParcelsContext.Provider

export function useNearbyParcelsState(): NearbyParcelsContextValue {
  const value = useContext(NearbyParcelsContext)
  if (value === null) {
    throw new Error("useNearbyParcelsState must be used inside AppStateProvider")
  }
  return value
}
