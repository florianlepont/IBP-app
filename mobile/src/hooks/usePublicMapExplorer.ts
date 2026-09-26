import { useCallback, useRef, useState } from "react"
import { fetchPublicMapItems, fetchPublicParcelStatuses } from "../api/ibp-api"
import { PublicMapItem, PublicParcelStatusItem } from "../app/types"
import { fr, logStatusDetail, type StatusMessage } from "../i18n"

type UsePublicMapExplorerArgs = {
  apiUrl: string
  onStatusChange: (message: StatusMessage) => void
}

export type LoadPublicMapOptions = {
  /** Viewport, minLng,minLat,maxLng,maxLat; omitted loads every item. */
  bbox?: string
  /** Reloads even when the request equals the last one. */
  force?: boolean
}

type LoadParcelsInput = {
  bbox: string
  zoom: number
}

export function usePublicMapExplorer({ apiUrl, onStatusChange }: UsePublicMapExplorerArgs) {
  const [items, setItems] = useState<PublicMapItem[]>([])
  const [loading, setLoading] = useState(false)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [region, setRegion] = useState("")
  const [parcelStatuses, setParcelStatuses] = useState<PublicParcelStatusItem[]>([])
  const [parcelsLoading, setParcelsLoading] = useState(false)
  const requestRef = useRef(0)
  const itemsRequestRef = useRef(0)
  const lastItemsKeyRef = useRef<string | null>(null)
  const pendingItemsKeyRef = useRef<string | null>(null)

  /**
   * Loads the public map items (D-05). A call without options is an explicit
   * reload (Load button, Explorer tab press) and always fetches. With options,
   * a request equal to the one in flight or the last completed one is skipped
   * unless `force` is set. Only the latest request updates the state.
   */
  const loadPublicMap = useCallback(
    async (options?: LoadPublicMapOptions): Promise<void> => {
      const bbox = options?.bbox?.trim() || undefined
      const key = [bbox ?? "all", fromDate, toDate, region].join("|")
      const force = options === undefined || options.force === true
      if (!force && (key === pendingItemsKeyRef.current || key === lastItemsKeyRef.current)) {
        return
      }

      const requestId = itemsRequestRef.current + 1
      itemsRequestRef.current = requestId
      pendingItemsKeyRef.current = key
      setLoading(true)

      try {
        const payload = await fetchPublicMapItems(apiUrl, {
          from: fromDate,
          to: toDate,
          region,
          bbox,
        })
        if (itemsRequestRef.current !== requestId) {
          return
        }
        const nextItems = Array.isArray(payload.items) ? payload.items : []
        lastItemsKeyRef.current = key
        setItems(nextItems)
        onStatusChange(fr.status.map.loaded({ count: nextItems.length }))
      } catch (error) {
        if (itemsRequestRef.current === requestId) {
          lastItemsKeyRef.current = null
          logStatusDetail("map.load", error)
          onStatusChange(fr.status.map.loadFailed())
        }
      } finally {
        if (itemsRequestRef.current === requestId) {
          pendingItemsKeyRef.current = null
          setLoading(false)
        }
      }
    },
    [apiUrl, fromDate, onStatusChange, region, toDate],
  )

  const loadPublicParcels = useCallback(
    async (input: LoadParcelsInput): Promise<void> => {
      if (!input.bbox || input.bbox.trim().length === 0) {
        return
      }

      const requestId = requestRef.current + 1
      requestRef.current = requestId
      setParcelsLoading(true)

      try {
        const payload = await fetchPublicParcelStatuses(apiUrl, {
          bbox: input.bbox,
          zoom: input.zoom,
          year: new Date().getFullYear(),
        })

        if (requestRef.current !== requestId) {
          return
        }

        const nextItems = Array.isArray(payload.items) ? payload.items : []
        setParcelStatuses(nextItems)
      } catch (error) {
        if (requestRef.current === requestId) {
          logStatusDetail("map.parcels", error)
          onStatusChange(fr.status.map.parcelsLoadFailed())
        }
      } finally {
        if (requestRef.current === requestId) {
          setParcelsLoading(false)
        }
      }
    },
    [apiUrl, onStatusChange],
  )

  return {
    items,
    loading,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    region,
    setRegion,
    parcelStatuses,
    parcelsLoading,
    loadPublicMap,
    loadPublicParcels,
  }
}
