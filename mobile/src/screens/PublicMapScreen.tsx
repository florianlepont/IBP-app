import { useCallback, useMemo, useRef, useState } from "react"
import { Alert, View } from "react-native"
import type MapView from "react-native-maps"
import type { LatLng, Region } from "react-native-maps"
import * as Location from "expo-location"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAppBottomTabBarHeight } from "../app/useAppBottomTabBarHeight"
import type { PublicMapItem, PublicParcelStatusItem } from "../app/types"
import type { LoadPublicMapOptions } from "../hooks/usePublicMapExplorer"
import { fr } from "../i18n"
import { useLatestCallback } from "../state/useLatestCallback"
import { ClusterListSheet } from "./public-map/ClusterListSheet"
import { MapCanvas } from "./public-map/MapCanvas"
import { MapBottomDock, MapTopControls } from "./public-map/MapControls"
import { SelectedSurveyCard } from "./public-map/SelectedSurveyCard"
import { screenStyles } from "./public-map/styles"
import { PARCEL_MIN_ZOOM, useMapViewport } from "./public-map/useMapViewport"

const t = fr.publicMap
const LOCATE_SPAN = 0.012

type PublicMapScreenProps = {
  items: PublicMapItem[]
  parcelStatuses: PublicParcelStatusItem[]
  ownSurveyIds: string[]
  loading: boolean
  parcelsLoading: boolean
  fromDate: string
  toDate: string
  region: string
  onChangeFromDate: (value: string) => void
  onChangeToDate: (value: string) => void
  onChangeRegion: (value: string) => void
  onLoad: (options?: LoadPublicMapOptions) => Promise<void>
  onLoadParcels: (input: { bbox: string; zoom: number }) => Promise<void>
  onReportSurvey: (surveyId: string, reason: string) => Promise<{ ok: boolean; message: string }>
  /** Told the bbox of each viewport load, so the Explorer tab reload can reuse it. */
  onViewportBboxChange?: (bbox: string) => void
}

/**
 * Public map (D-05): items load by viewport after the region settles, markers
 * are clustered and memoised, and the camera fits the items only on the first
 * load or after a filter apply. The parts live in screens/public-map/.
 */
export function PublicMapScreen({
  items,
  parcelStatuses,
  ownSurveyIds,
  loading,
  parcelsLoading,
  fromDate,
  toDate,
  region,
  onChangeFromDate,
  onChangeToDate,
  onChangeRegion,
  onLoad,
  onLoadParcels,
  onReportSurvey,
  onViewportBboxChange,
}: PublicMapScreenProps) {
  const mapRef = useRef<MapView | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showParcelLayer, setShowParcelLayer] = useState(true)
  const [selectedItem, setSelectedItem] = useState<PublicMapItem | null>(null)
  const [clusterItems, setClusterItems] = useState<PublicMapItem[] | null>(null)
  const [locating, setLocating] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null)
  const insets = useSafeAreaInsets()
  const tabBarHeight = useAppBottomTabBarHeight()

  const animateToRegion = useCallback((target: Region, durationMs: number) => {
    mapRef.current?.animateToRegion(target, durationMs)
  }, [])

  const viewport = useMapViewport({
    items,
    showParcelLayer,
    loadPublicMap: onLoad,
    loadParcels: onLoadParcels,
    animateToRegion,
    onViewportBboxChange,
  })

  const ownSurveyIdSet = useMemo(() => new Set(ownSurveyIds), [ownSurveyIds])
  const itemsById = useMemo(() => new Map(items.map((item) => [item.survey_id, item])), [items])

  const layerStatusLabel = !showParcelLayer
    ? t.layer.hidden
    : parcelsLoading
      ? t.layer.loading
      : viewport.zoom >= PARCEL_MIN_ZOOM
        ? t.layer.active
        : t.layer.zoomIn

  const handleSelectSurvey = useLatestCallback((id: string) => {
    const item = itemsById.get(id) ?? clusterItems?.find((entry) => entry.survey_id === id)
    if (item) {
      setSelectedItem(item)
      setClusterItems(null)
    }
  })
  const handleOpenClusterList = useCallback((leaves: PublicMapItem[]) => {
    setSelectedItem(null)
    setClusterItems(leaves)
  }, [])
  const { moveTo } = viewport
  const handleZoomTo = useCallback((target: Region) => moveTo(target, 450), [moveTo])
  const closeSelection = useCallback(() => setSelectedItem(null), [])
  const closeClusterList = useCallback(() => setClusterItems(null), [])
  const toggleFilters = useCallback(() => setShowFilters((current) => !current), [])
  const toggleParcelLayer = useCallback(() => setShowParcelLayer((current) => !current), [])

  const handleLocate = useLatestCallback(async (): Promise<void> => {
    if (locating) {
      return
    }
    try {
      setLocating(true)
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!permission.granted) {
        Alert.alert(t.alerts.locationDisabled.title, t.alerts.locationDisabled.message)
        return
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      const { latitude, longitude } = position.coords
      setCurrentLocation({ latitude, longitude })
      moveTo({ latitude, longitude, latitudeDelta: LOCATE_SPAN, longitudeDelta: LOCATE_SPAN }, 450)
    } catch (_error) {
      Alert.alert(t.alerts.locationUnavailable.title, t.alerts.locationUnavailable.message)
    } finally {
      setLocating(false)
    }
  })
  const onLocate = useCallback(() => void handleLocate(), [handleLocate])

  const dockBottom = Math.max(tabBarHeight, insets.bottom)

  return (
    <View style={screenStyles.container}>
      <MapCanvas
        mapRef={mapRef}
        items={items}
        region={viewport.region}
        selectedId={selectedItem?.survey_id ?? null}
        parcelStatuses={parcelStatuses}
        parcelLayerRenderable={viewport.parcelLayerRenderable}
        currentLocation={currentLocation}
        onRegionChangeComplete={viewport.onRegionChangeComplete}
        onSelectSurvey={handleSelectSurvey}
        onZoomTo={handleZoomTo}
        onOpenClusterList={handleOpenClusterList}
      />

      <MapTopControls
        top={insets.top + 40}
        count={items.length}
        loading={loading}
        showFilters={showFilters}
        showParcelLayer={showParcelLayer}
        layerStatusLabel={layerStatusLabel}
        fromDate={fromDate}
        toDate={toDate}
        region={region}
        onToggleFilters={toggleFilters}
        onToggleParcelLayer={toggleParcelLayer}
        onRefresh={viewport.reload}
        onApplyFilters={viewport.applyFilters}
        onChangeFromDate={onChangeFromDate}
        onChangeToDate={onChangeToDate}
        onChangeRegion={onChangeRegion}
      />

      <MapBottomDock
        bottom={Math.max(12, dockBottom + 10)}
        showEmpty={!loading && items.length === 0}
        locating={locating}
        onLocate={onLocate}
      />

      {clusterItems ? (
        <ClusterListSheet
          items={clusterItems}
          bottom={Math.max(84, dockBottom + 62)}
          onSelect={handleSelectSurvey}
          onClose={closeClusterList}
        />
      ) : null}

      {selectedItem ? (
        <SelectedSurveyCard
          key={selectedItem.survey_id}
          item={selectedItem}
          isOwnSurvey={ownSurveyIdSet.has(selectedItem.survey_id)}
          bottom={Math.max(84, dockBottom + 62)}
          onClose={closeSelection}
          onReportSurvey={onReportSurvey}
        />
      ) : null}
    </View>
  )
}
