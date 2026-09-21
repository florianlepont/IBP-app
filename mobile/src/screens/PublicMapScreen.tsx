import { useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native"
import MapView, { Marker, Region } from "react-native-maps"
import { Ionicons } from "@expo/vector-icons"
import * as Location from "expo-location"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAppBottomTabBarHeight } from "../app/useAppBottomTabBarHeight"
import { brandColors, brandRadius, brandShadow, brandTypography } from "../app/brand-tokens"
import { PublicMapItem, PublicParcelStatusItem } from "../app/types"
import { computeRegionBbox, computeRegionZoom } from "../app/map-viewport"
import { IgnCadastreTileOverlay } from "../components/IgnCadastreTileOverlay"
import { ParcelOverlayPolygons } from "../components/ParcelOverlayPolygons"
import { AppButton } from "../ui/AppButton"
import { AppCard } from "../ui/AppCard"
import { AppField } from "../ui/AppField"
import { AppNotice } from "../ui/AppNotice"
import { AppSectionHeader } from "../ui/AppSectionHeader"

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
  onLoad: () => Promise<void>
  onLoadParcels: (input: { bbox: string; zoom: number }) => Promise<void>
  onReportSurvey: (surveyId: string, reason: string) => Promise<{ ok: boolean; message: string }>
}

const DEFAULT_REGION: Region = {
  latitude: 46.603354,
  longitude: 1.888334,
  latitudeDelta: 7,
  longitudeDelta: 7,
}

function computeRegionFromItems(items: PublicMapItem[]): Region {
  if (items.length === 0) {
    return DEFAULT_REGION
  }

  let minLat = Number.POSITIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY
  let minLng = Number.POSITIVE_INFINITY
  let maxLng = Number.NEGATIVE_INFINITY

  for (const item of items) {
    const lat = item.display_location.lat
    const lng = item.display_location.lng
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue
    }
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
  }

  if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) {
    return DEFAULT_REGION
  }

  const latitude = (minLat + maxLat) / 2
  const longitude = (minLng + maxLng) / 2
  const latitudeDelta = Math.max(0.08, (maxLat - minLat) * 1.4)
  const longitudeDelta = Math.max(0.08, (maxLng - minLng) * 1.4)

  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta,
  }
}

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
}: PublicMapScreenProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [showParcelLayer, setShowParcelLayer] = useState(true)
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION)
  const [selectedItem, setSelectedItem] = useState<PublicMapItem | null>(null)
  const [reportPanelOpen, setReportPanelOpen] = useState(false)
  const [reportReason, setReportReason] = useState("")
  const [reportSending, setReportSending] = useState(false)
  const [reportMessage, setReportMessage] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [currentLocationMarker, setCurrentLocationMarker] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const mapRef = useRef<MapView | null>(null)
  const onLoadParcelsRef = useRef(onLoadParcels)
  const lastParcelsRequestKeyRef = useRef("")
  const insets = useSafeAreaInsets()
  const tabBarHeight = useAppBottomTabBarHeight()
  const ownSurveyIdSet = useMemo(() => new Set(ownSurveyIds), [ownSurveyIds])
  const targetRegion = useMemo(() => computeRegionFromItems(items), [items])
  const selectedItemIsOwnSurvey = selectedItem ? ownSurveyIdSet.has(selectedItem.survey_id) : false
  const mapZoom = useMemo(() => computeRegionZoom(mapRegion), [mapRegion])
  const parcelLayerRenderable = showParcelLayer && mapZoom >= 15
  const visibleCountLabel = `${items.length} public survey${items.length === 1 ? "" : "s"}`
  const layerStatusLabel = !showParcelLayer
    ? "Parcels hidden"
    : parcelsLoading
      ? "Loading cadastre"
      : mapZoom >= 15
        ? "Cadastre active"
        : "Zoom in to unlock parcels"

  useEffect(() => {
    setMapRegion(targetRegion)
    mapRef.current?.animateToRegion(targetRegion, 520)
  }, [targetRegion])

  useEffect(() => {
    onLoadParcelsRef.current = onLoadParcels
  }, [onLoadParcels])

  useEffect(() => {
    if (!parcelLayerRenderable) {
      lastParcelsRequestKeyRef.current = ""
      return
    }
    const timer = setTimeout(() => {
      const bbox = computeRegionBbox(mapRegion)
      const key = `${mapZoom.toFixed(2)}:${bbox}`
      if (lastParcelsRequestKeyRef.current === key) {
        return
      }
      lastParcelsRequestKeyRef.current = key
      void onLoadParcelsRef.current({ bbox, zoom: mapZoom })
    }, 400)

    return () => clearTimeout(timer)
  }, [parcelLayerRenderable, mapRegion, mapZoom])

  const handleCenterOnCurrentLocation = async (): Promise<void> => {
    if (locating) {
      return
    }

    try {
      setLocating(true)
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!permission.granted) {
        Alert.alert(
          "Location disabled",
          "Allow location access to center the map on your position.",
        )
        return
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      const nextRegion: Region = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      }
      setCurrentLocationMarker({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      })
      setMapRegion(nextRegion)
      mapRef.current?.animateToRegion(nextRegion, 450)
    } catch (_error) {
      Alert.alert("Location unavailable", "Unable to retrieve your current position.")
    } finally {
      setLocating(false)
    }
  }

  const showEmptyDock = !loading && items.length === 0

  return (
    <View style={screenStyles.container}>
      <MapView
        ref={mapRef}
        style={screenStyles.map}
        initialRegion={mapRegion}
        onRegionChangeComplete={setMapRegion}
      >
        <IgnCadastreTileOverlay enabled={parcelLayerRenderable} zIndex={0} />
        <ParcelOverlayPolygons items={parcelLayerRenderable ? parcelStatuses : []} />
        {currentLocationMarker ? (
          <Marker
            coordinate={{
              latitude: currentLocationMarker.lat,
              longitude: currentLocationMarker.lng,
            }}
            pinColor="#245f96"
            title="Your position"
            zIndex={3}
          />
        ) : null}
        {items.map((item) => (
          <Marker
            key={item.survey_id}
            coordinate={{
              latitude: item.display_location.lat,
              longitude: item.display_location.lng,
            }}
            onPress={() => {
              setSelectedItem(item)
              setReportPanelOpen(false)
              setReportReason("")
              setReportMessage(null)
            }}
            pinColor="#2a7a52"
            title={`IBP ${item.ibp_total}`}
            description={`${item.region_code} - ${item.survey_date}`}
            zIndex={2}
          />
        ))}
      </MapView>

      <View pointerEvents="box-none" style={[screenStyles.overlayShell, { top: insets.top + 40 }]}>
        <View style={screenStyles.topDock}>
          <View style={screenStyles.topDockLeft}>
            <View style={screenStyles.exploreBadge}>
              <Ionicons name="globe-outline" size={15} color={brandColors.forest} />
              <Text style={screenStyles.exploreBadgeText}>Explorer</Text>
            </View>
            <View style={screenStyles.countBadge}>
              <Text style={screenStyles.countBadgeText}>{visibleCountLabel}</Text>
            </View>
          </View>

          <View style={screenStyles.topDockActions}>
            <Pressable
              style={screenStyles.iconButton}
              onPress={() => setShowFilters((current) => !current)}
            >
              <Ionicons
                name={showFilters ? "close-outline" : "options-outline"}
                size={18}
                color={brandColors.forest}
              />
            </Pressable>
            <Pressable
              style={loading ? screenStyles.iconButtonDisabled : screenStyles.iconButtonPrimary}
              onPress={() => {
                void onLoad()
                if (parcelLayerRenderable) {
                  void onLoadParcels({ bbox: computeRegionBbox(mapRegion), zoom: mapZoom })
                }
              }}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={brandColors.white} />
              ) : (
                <Ionicons name="refresh" size={18} color={brandColors.white} />
              )}
            </Pressable>
          </View>
        </View>

        {showFilters ? (
          <AppCard variant="panelElevated" padding={14} style={screenStyles.filtersPanel}>
            <AppSectionHeader
              title="Filters"
              subtitle="Tune the published survey slice without leaving the map."
              titleStyle={screenStyles.filtersTitle}
              subtitleStyle={screenStyles.filtersMeta}
              trailing={
                <Pressable
                  style={[
                    screenStyles.layerTogglePill,
                    showParcelLayer
                      ? screenStyles.layerTogglePillOn
                      : screenStyles.layerTogglePillOff,
                  ]}
                  onPress={() => setShowParcelLayer((current) => !current)}
                >
                  <Ionicons
                    name={showParcelLayer ? "layers" : "layers-outline"}
                    size={14}
                    color={showParcelLayer ? brandColors.white : brandColors.forest}
                  />
                  <Text
                    style={[
                      screenStyles.layerTogglePillText,
                      showParcelLayer ? screenStyles.layerTogglePillTextOn : null,
                    ]}
                  >
                    {layerStatusLabel}
                  </Text>
                </Pressable>
              }
            />

            <View style={screenStyles.filtersGrid}>
              <AppField
                label="From"
                value={fromDate}
                onChangeText={onChangeFromDate}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="2026-03-01"
                containerStyle={screenStyles.filterFieldHalf}
                labelStyle={screenStyles.inputLabel}
                inputStyle={screenStyles.input}
              />

              <AppField
                label="To"
                value={toDate}
                onChangeText={onChangeToDate}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="2026-03-31"
                containerStyle={screenStyles.filterFieldHalf}
                labelStyle={screenStyles.inputLabel}
                inputStyle={screenStyles.input}
              />

              <AppField
                label="Region"
                value={region}
                onChangeText={onChangeRegion}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="ACA"
                containerStyle={screenStyles.filterFieldFull}
                labelStyle={screenStyles.inputLabel}
                inputStyle={screenStyles.input}
              />

              <AppButton
                label={loading ? "Refreshing…" : "Refresh map"}
                leadingIcon="sparkles-outline"
                onPress={() => {
                  void onLoad()
                  if (parcelLayerRenderable) {
                    void onLoadParcels({ bbox: computeRegionBbox(mapRegion), zoom: mapZoom })
                  }
                }}
                disabled={loading}
                style={[
                  screenStyles.refreshButton,
                  loading ? screenStyles.refreshButtonDisabled : null,
                ]}
              />
            </View>
          </AppCard>
        ) : null}
      </View>

      <View
        style={[
          screenStyles.bottomDock,
          { bottom: Math.max(12, Math.max(tabBarHeight, insets.bottom) + 10) },
        ]}
      >
        {showEmptyDock ? (
          <AppCard variant="panelElevated" padding={14} style={screenStyles.emptyDockBubble}>
            <Text style={screenStyles.emptyDockText}>No public items found</Text>
          </AppCard>
        ) : (
          <View />
        )}

        <Pressable
          style={screenStyles.locateButton}
          onPress={() => void handleCenterOnCurrentLocation()}
          disabled={locating}
        >
          {locating ? (
            <ActivityIndicator size="small" color={brandColors.white} />
          ) : (
            <Ionicons name="locate" size={20} color={brandColors.white} />
          )}
        </Pressable>
      </View>

      {selectedItem ? (
        <AppCard
          variant="panelElevated"
          padding={14}
          style={[
            screenStyles.reportCard,
            { bottom: Math.max(84, Math.max(tabBarHeight, insets.bottom) + 62) },
          ]}
        >
          <AppSectionHeader
            title={`Survey ${selectedItem.survey_id}`}
            trailing={
              <Pressable onPress={() => setSelectedItem(null)}>
                <Ionicons name="close" size={18} color="#40654f" />
              </Pressable>
            }
            titleStyle={screenStyles.reportTitle}
          />
          <Text style={screenStyles.reportMeta}>
            {selectedItem.region_code} · {selectedItem.survey_date} · IBP {selectedItem.ibp_total}
          </Text>

          {selectedItemIsOwnSurvey ? (
            <AppNotice
              tone="info"
              icon="information-circle-outline"
              message="You cannot report your own survey."
            />
          ) : !reportPanelOpen ? (
            <AppButton
              label="Report this survey"
              leadingIcon="flag-outline"
              variant="danger"
              size="sm"
              onPress={() => setReportPanelOpen(true)}
              style={screenStyles.reportOpenButton}
              labelStyle={screenStyles.reportOpenButtonText}
            />
          ) : (
            <View style={screenStyles.reportForm}>
              <AppField
                label="Reason (required)"
                value={reportReason}
                onChangeText={setReportReason}
                autoCapitalize="sentences"
                autoCorrect
                multiline
                numberOfLines={3}
                placeholder="Explain why this survey looks suspicious"
                containerStyle={screenStyles.reportField}
                labelStyle={screenStyles.inputLabel}
                inputStyle={screenStyles.reportInput}
              />
              <View style={screenStyles.reportActionsRow}>
                <AppButton
                  label="Cancel"
                  variant="secondary"
                  size="sm"
                  style={screenStyles.reportCancelButton}
                  onPress={() => {
                    setReportPanelOpen(false)
                    setReportReason("")
                    setReportMessage(null)
                  }}
                  disabled={reportSending}
                  labelStyle={screenStyles.reportCancelButtonText}
                />
                <AppButton
                  label={reportSending ? "Sending..." : "Send report"}
                  variant="danger"
                  size="sm"
                  style={[
                    screenStyles.reportSubmitButton,
                    reportSending ? screenStyles.reportSubmitButtonDisabled : null,
                  ]}
                  disabled={reportSending}
                  onPress={() => {
                    if (reportSending) return
                    setReportSending(true)
                    void onReportSurvey(selectedItem.survey_id, reportReason)
                      .then((result) => {
                        setReportMessage(result.message)
                        if (result.ok) {
                          setReportPanelOpen(false)
                          setReportReason("")
                        }
                      })
                      .finally(() => setReportSending(false))
                  }}
                  labelStyle={screenStyles.reportSubmitButtonText}
                />
              </View>
              {reportMessage ? (
                <Text style={screenStyles.reportMessage}>{reportMessage}</Text>
              ) : null}
            </View>
          )}
        </AppCard>
      ) : null}
    </View>
  )
}

const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  overlayShell: {
    position: "absolute",
    left: 12,
    right: 12,
    gap: 10,
  },
  topDock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  topDockLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    flex: 1,
  },
  topDockActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  exploreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: "rgba(247, 246, 240, 0.94)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...brandShadow.card,
  },
  exploreBadgeText: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  countBadge: {
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: "rgba(232, 229, 217, 0.94)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  countBadgeText: {
    ...brandTypography.meta,
    color: brandColors.textPrimary,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: "rgba(247, 246, 240, 0.94)",
    alignItems: "center",
    justifyContent: "center",
    ...brandShadow.card,
  },
  iconButtonPrimary: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: brandColors.forest,
    backgroundColor: brandColors.forest,
    alignItems: "center",
    justifyContent: "center",
    ...brandShadow.card,
  },
  iconButtonDisabled: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: "#93A68A",
    alignItems: "center",
    justifyContent: "center",
    ...brandShadow.card,
  },
  filtersPanel: {
    backgroundColor: "rgba(247, 246, 240, 0.96)",
    gap: 12,
  },
  filtersTitle: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  filtersMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  layerTogglePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  layerTogglePillOn: {
    borderColor: brandColors.forest,
    backgroundColor: brandColors.forest,
  },
  layerTogglePillOff: {
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panelMuted,
  },
  layerTogglePillText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  layerTogglePillTextOn: {
    color: brandColors.white,
  },
  filtersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterFieldHalf: {
    flexGrow: 1,
    flexBasis: "48%",
    gap: 5,
  },
  filterFieldFull: {
    width: "100%",
    gap: 5,
  },
  inputLabel: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  input: {
    ...brandTypography.input,
  },
  refreshButton: {
    width: "100%",
  },
  refreshButtonDisabled: {
    backgroundColor: "#8FA188",
    borderColor: "#8FA188",
  },
  reportCard: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: "rgba(247, 246, 240, 0.98)",
    gap: 10,
  },
  reportTitle: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  reportMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  reportOpenButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E4B99A",
    backgroundColor: "#F6E2D5",
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reportOpenButtonText: {
    ...brandTypography.meta,
    color: brandColors.terracotta,
  },
  reportForm: {
    gap: 10,
  },
  reportField: {
    gap: 5,
  },
  reportInput: {
    minHeight: 72,
    textAlignVertical: "top",
    ...brandTypography.sectionBody,
  },
  reportActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  reportCancelButton: {},
  reportCancelButtonText: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  reportSubmitButton: {},
  reportSubmitButtonDisabled: {
    borderColor: "#A6ABA3",
    backgroundColor: "#A6ABA3",
  },
  reportSubmitButtonText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  reportMessage: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  bottomDock: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  emptyDockBubble: {
    flex: 1,
    backgroundColor: "rgba(247, 246, 240, 0.96)",
  },
  emptyDockText: {
    ...brandTypography.meta,
    fontSize: 15,
    lineHeight: 18,
    color: brandColors.textPrimary,
  },
  locateButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.forest,
    backgroundColor: brandColors.forest,
    alignItems: "center",
    justifyContent: "center",
    ...brandShadow.card,
  },
})
