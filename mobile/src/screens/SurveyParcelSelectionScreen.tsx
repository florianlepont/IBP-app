import { useEffect, useMemo, useRef, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useHeaderHeight } from "@react-navigation/elements"
import MapView, { Marker, Region } from "react-native-maps"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAppBottomTabBarHeight } from "../app/useAppBottomTabBarHeight"
import { brandColors, brandShadow, brandTypography } from "../app/brand-tokens"
import {
  DEFAULT_FRANCE_CENTER,
  areRegionsNearlyEqual,
  buildFocusedMapRegion,
  computeRegionZoom,
} from "../app/map-viewport"
import { GpsCaptureResult } from "../app/types"
import { IgnCadastreTileOverlay } from "../components/IgnCadastreTileOverlay"
import { ParcelOverlayPolygons } from "../components/ParcelOverlayPolygons"
import { useParcelStatuses } from "../hooks/useParcelStatuses"
import { AppButton } from "../ui/AppButton"
import { AppCard } from "../ui/AppCard"
import { AppNotice } from "../ui/AppNotice"
import { fr } from "../i18n"

const t = fr.parcelSelection

type SurveyParcelSelectionScreenProps = {
  apiUrl: string
  gpsLocation: {
    lat: string
    lng: string
    collected_at: string
  }
  selectedParcelIds: string[]
  onToggleParcelSelection: (parcelId: string) => void
  onCaptureGpsLocation: () => Promise<GpsCaptureResult | null>
  onSave: () => Promise<void>
  hideDoneAction?: boolean
}

export function SurveyParcelSelectionScreen({
  apiUrl,
  gpsLocation,
  selectedParcelIds,
  onToggleParcelSelection,
  onCaptureGpsLocation,
  onSave,
  hideDoneAction = false,
}: SurveyParcelSelectionScreenProps) {
  const mapRef = useRef<MapView | null>(null)
  const mapReadyRef = useRef(false)
  const pendingRegionRef = useRef<Region | null>(null)
  const headerHeight = useHeaderHeight()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useAppBottomTabBarHeight()
  const [saving, setSaving] = useState(false)
  const parsedLat = Number(gpsLocation.lat)
  const parsedLng = Number(gpsLocation.lng)
  const hasGpsCoordinates = Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
  const mapCenter = hasGpsCoordinates ? { lat: parsedLat, lng: parsedLng } : DEFAULT_FRANCE_CENTER
  const initialRegion: Region = hasGpsCoordinates
    ? buildFocusedMapRegion(mapCenter)
    : {
        latitude: mapCenter.lat,
        longitude: mapCenter.lng,
        latitudeDelta: 3.8,
        longitudeDelta: 3.8,
      }
  const [mapRegion, setMapRegion] = useState<Region>(initialRegion)
  const mapZoom = useMemo(() => computeRegionZoom(mapRegion), [mapRegion])
  const { items: parcelStatuses, loading: parcelsLoading } = useParcelStatuses({
    apiUrl,
    region: mapRegion,
    enabled: true,
    year: new Date().getFullYear(),
  })

  const syncMapRegion = (nextRegion: Region, duration = 420): void => {
    if (!mapReadyRef.current || !mapRef.current) {
      pendingRegionRef.current = nextRegion
      return
    }

    pendingRegionRef.current = null
    mapRef.current.animateToRegion(nextRegion, duration)
  }

  const handleMapReady = (): void => {
    mapReadyRef.current = true
    const nextRegion = pendingRegionRef.current ?? mapRegion
    pendingRegionRef.current = null
    requestAnimationFrame(() => {
      mapRef.current?.animateToRegion(nextRegion, 0)
    })
  }

  useEffect(() => {
    if (!hasGpsCoordinates) {
      return
    }
    const nextRegion = buildFocusedMapRegion({ lat: parsedLat, lng: parsedLng })
    setMapRegion((current) => (areRegionsNearlyEqual(current, nextRegion) ? current : nextRegion))
    syncMapRegion(nextRegion, 420)
  }, [hasGpsCoordinates, parsedLat, parsedLng, gpsLocation.collected_at])

  const handleMapRegionChange = (nextRegion: Region): void => {
    setMapRegion((current) => (areRegionsNearlyEqual(current, nextRegion) ? current : nextRegion))
  }

  const hasParcelSelection = selectedParcelIds.length > 0
  const parcelSelectionLabel = t.selectedCount({ count: selectedParcelIds.length })
  const parcelHelperText =
    mapZoom >= 15
      ? parcelsLoading
        ? t.loadingOverlay
        : t.visibleCount({ count: parcelStatuses.length })
      : t.zoomToSelect

  return (
    <View
      style={[
        screenStyles.fullscreen,
        {
          marginTop: -headerHeight,
        },
      ]}
    >
      <MapView
        ref={(instance) => {
          mapRef.current = instance
          if (!instance) {
            mapReadyRef.current = false
            return
          }
          mapReadyRef.current = false
        }}
        style={screenStyles.map}
        initialRegion={mapRegion}
        onMapReady={handleMapReady}
        onRegionChangeComplete={handleMapRegionChange}
      >
        <IgnCadastreTileOverlay enabled={mapZoom >= 15} zIndex={0} />
        <ParcelOverlayPolygons
          items={parcelStatuses}
          selectedParcelIds={selectedParcelIds}
          onParcelPress={onToggleParcelSelection}
        />
        {hasGpsCoordinates ? (
          <Marker coordinate={{ latitude: parsedLat, longitude: parsedLng }} />
        ) : null}
      </MapView>

      <View
        pointerEvents="box-none"
        style={[
          screenStyles.overlayLayer,
          {
            paddingBottom: Math.max(Math.max(tabBarHeight, insets.bottom), 12) + 12,
          },
        ]}
      >
        <View style={screenStyles.bottomArea}>
          <View style={screenStyles.floatingActions}>
            <AppButton
              label={t.currentPosition}
              leadingIcon="locate-outline"
              size="sm"
              style={screenStyles.locateButton}
              onPress={() => {
                void onCaptureGpsLocation().then((capturedLocation) => {
                  if (!capturedLocation) {
                    return
                  }
                  const nextRegion = buildFocusedMapRegion(capturedLocation)
                  setMapRegion((current) =>
                    areRegionsNearlyEqual(current, nextRegion) ? current : nextRegion,
                  )
                  syncMapRegion(nextRegion, 420)
                })
              }}
            />
          </View>

          <AppCard variant="panelElevated" style={screenStyles.bottomSheet}>
            <Text style={screenStyles.bottomTitle}>
              {hasParcelSelection ? parcelSelectionLabel : t.noSelection}
            </Text>
            <Text style={screenStyles.bottomMeta}>{parcelHelperText}</Text>
            {!hasParcelSelection ? (
              <AppNotice tone="danger" icon="alert-circle-outline" message={t.selectionRequired} />
            ) : null}
            <Text style={screenStyles.bottomHint}>{t.tapHint}</Text>
            {!hideDoneAction ? (
              <AppButton
                label={saving ? t.saving : t.done}
                leadingIcon={saving ? "hourglass-outline" : "checkmark"}
                size="lg"
                style={screenStyles.doneButton}
                onPress={() => {
                  if (saving) {
                    return
                  }
                  setSaving(true)
                  void onSave().finally(() => setSaving(false))
                }}
                disabled={saving}
              />
            ) : null}
          </AppCard>
        </View>
      </View>
    </View>
  )
}

const screenStyles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: "#132434",
  },
  map: {
    flex: 1,
    backgroundColor: "#132434",
  },
  overlayLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
  },
  bottomArea: {
    gap: 12,
  },
  floatingActions: {
    alignSelf: "flex-end",
  },
  locateButton: {
    borderWidth: 1,
    borderColor: "#8EA97C",
    ...brandShadow.card,
  },
  bottomSheet: {
    backgroundColor: "rgba(247, 246, 240, 0.97)",
    gap: 8,
  },
  bottomTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 20,
    lineHeight: 24,
    color: brandColors.forest,
  },
  bottomMeta: {
    ...brandTypography.sectionBody,
    fontSize: 13,
    lineHeight: 18,
    color: brandColors.textSecondary,
  },
  bottomHint: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  doneButton: {
    marginTop: 4,
    ...brandShadow.card,
  },
})
