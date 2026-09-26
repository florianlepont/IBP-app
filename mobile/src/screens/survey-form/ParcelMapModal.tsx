import { Button, Modal, Platform, Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import MapView, { Marker } from "react-native-maps"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { brandColors } from "../../app/brand-tokens"
import { IgnCadastreTileOverlay } from "../../components/IgnCadastreTileOverlay"
import { ParcelOverlayPolygons } from "../../components/ParcelOverlayPolygons"
import { parcelStyles } from "./parcels.styles"
import type { ParcelMapState } from "./useParcelMap"

// Full-screen parcel map of step 2.
export function ParcelMapModal({
  map,
  siteName,
  selectedParcelIds,
  onToggleParcelSelection,
}: {
  map: ParcelMapState
  siteName: string
  selectedParcelIds: string[]
  onToggleParcelSelection: (parcelId: string) => void
}) {
  const insets = useSafeAreaInsets()
  const hasParcelSelection = selectedParcelIds.length > 0
  const parcelSelectionLabel = `${selectedParcelIds.length} parcel${selectedParcelIds.length > 1 ? "s" : ""} selected`
  const fullscreenParcelSelectionTitle = hasParcelSelection
    ? parcelSelectionLabel
    : "No parcel selected yet"

  return (
    <Modal
      visible={map.isParcelMapFullscreenVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={map.closeFullscreenMap}
    >
      <View style={parcelStyles.fullscreenMapScreen}>
        <MapView
          ref={map.setFullscreenMapInstance}
          style={parcelStyles.fullscreenMap}
          initialRegion={map.mapRegion}
          onMapReady={map.handleFullscreenMapReady}
          onRegionChangeComplete={map.handleMapRegionChange}
        >
          <IgnCadastreTileOverlay enabled={map.mapZoom >= 15} zIndex={0} />
          <ParcelOverlayPolygons
            items={map.parcelStatuses}
            selectedParcelIds={selectedParcelIds}
            onParcelPress={onToggleParcelSelection}
          />
          {map.gpsMarker ? <Marker coordinate={map.gpsMarker} /> : null}
        </MapView>

        <View
          pointerEvents="box-none"
          style={[
            parcelStyles.fullscreenMapOverlay,
            {
              paddingTop: insets.top + 8,
              paddingBottom: Math.max(insets.bottom, 12) + 12,
            },
          ]}
        >
          <View style={parcelStyles.fullscreenMapTopBar}>
            {Platform.OS === "ios" ? (
              <>
                <Button title="Back" color={brandColors.forest} onPress={map.closeFullscreenMap} />
                <Text numberOfLines={1} style={parcelStyles.fullscreenMapTopTitle}>
                  {siteName.trim() || "Parcel selection"}
                </Text>
                <Button title="Done" color={brandColors.forest} onPress={map.closeFullscreenMap} />
              </>
            ) : (
              <>
                <Pressable
                  style={parcelStyles.fullscreenMapCloseButton}
                  onPress={map.closeFullscreenMap}
                >
                  <Ionicons name="arrow-back" size={18} color={brandColors.white} />
                  <Text style={parcelStyles.fullscreenMapCloseText}>Back</Text>
                </Pressable>
                <Pressable
                  style={parcelStyles.fullscreenMapCloseButton}
                  onPress={map.closeFullscreenMap}
                >
                  <Text style={parcelStyles.fullscreenMapCloseText}>Done</Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={parcelStyles.fullscreenMapBottomArea}>
            <View style={parcelStyles.fullscreenMapFloatingActions}>
              <Pressable
                style={parcelStyles.fullscreenMapActionButton}
                onPress={map.handleLocateParcelsMap}
              >
                <Ionicons
                  name={map.isAutoLocatingParcels ? "hourglass-outline" : "locate-outline"}
                  size={18}
                  color={brandColors.white}
                />
                <Text style={parcelStyles.fullscreenMapActionButtonText}>Current position</Text>
              </Pressable>
            </View>

            <View style={parcelStyles.fullscreenMapBottomSheet}>
              <Text style={parcelStyles.fullscreenMapBottomTitle}>
                {fullscreenParcelSelectionTitle}
              </Text>
              <Text style={parcelStyles.fullscreenMapBottomMeta}>{map.helperText}</Text>
              {!hasParcelSelection ? (
                <View style={parcelStyles.fullscreenMapWarningCard}>
                  <Ionicons name="alert-circle-outline" size={18} color={brandColors.terracotta} />
                  <Text style={parcelStyles.fullscreenMapWarningText}>
                    Select at least one parcel to continue.
                  </Text>
                </View>
              ) : null}
              <Text style={parcelStyles.fullscreenMapBottomHint}>
                Tap polygons to add or remove parcels without leaving the wizard.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}
