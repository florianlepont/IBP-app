import { Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import MapView, { Marker } from "react-native-maps"
import { brandColors } from "../../app/brand-tokens"
import { IgnCadastreTileOverlay } from "../../components/IgnCadastreTileOverlay"
import { ParcelOverlayPolygons } from "../../components/ParcelOverlayPolygons"
import { AppCard } from "../../ui/AppCard"
import { AppNotice } from "../../ui/AppNotice"
import { AppSectionHeader } from "../../ui/AppSectionHeader"
import { parcelStyles } from "./parcels.styles"
import { formStyles } from "./styles"
import type { ParcelMapState } from "./useParcelMap"
import { fr } from "../../i18n"

// Parcel selection card of step 2: inline cadastre map, selected ids and the
// reverse-geocoded address.
export function ParcelsSection({
  map,
  selectedParcelIds,
  onToggleParcelSelection,
  onOpenParcelFullscreen,
}: {
  map: ParcelMapState
  selectedParcelIds: string[]
  onToggleParcelSelection: (parcelId: string) => void
  onOpenParcelFullscreen: () => void
}) {
  return (
    <AppCard variant="panelElevated" style={formStyles.panel}>
      <View style={parcelStyles.parcelHeaderRow}>
        <AppSectionHeader
          title={fr.surveyForm.parcels.title}
          subtitle={fr.surveyForm.parcels.subtitle}
          style={formStyles.panelHeaderCompact}
          titleStyle={formStyles.panelTitle}
          subtitleStyle={formStyles.panelBody}
        />
        <View style={parcelStyles.selectionCountPill}>
          <Text style={parcelStyles.selectionCountPillText}>
            {fr.surveyForm.parcels.selectedCount({ count: selectedParcelIds.length })}
          </Text>
        </View>
      </View>

      <View style={parcelStyles.mapFrame}>
        <MapView
          ref={map.setInlineMapInstance}
          style={parcelStyles.map}
          initialRegion={map.mapRegion}
          onMapReady={map.handleInlineMapReady}
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
        <View pointerEvents="box-none" style={parcelStyles.mapOverlayActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fr.surveyForm.a11y.openFullscreenMap}
            style={parcelStyles.mapOverlayButton}
            onPress={onOpenParcelFullscreen}
          >
            <Ionicons name="expand-outline" size={15} color={brandColors.white} />
            <Text style={parcelStyles.mapOverlayButtonText}>
              {fr.surveyForm.parcels.fullScreen}
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={parcelStyles.mapHelperText}>{map.helperText}</Text>

      {selectedParcelIds.length > 0 ? (
        <View style={parcelStyles.selectionSummaryRow}>
          {selectedParcelIds.slice(0, 4).map((parcelId) => (
            <View key={parcelId} style={parcelStyles.selectionPill}>
              <Text style={parcelStyles.selectionPillText}>{parcelId}</Text>
            </View>
          ))}
          {selectedParcelIds.length > 4 ? (
            <View style={parcelStyles.selectionPill}>
              <Text style={parcelStyles.selectionPillText}>
                {fr.surveyForm.parcels.moreCount({ count: selectedParcelIds.length - 4 })}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {map.isResolvingGpsAddress ? (
        <AppNotice
          tone="info"
          icon="navigate-outline"
          title={fr.surveyForm.parcels.addressTitle}
          message={fr.surveyForm.parcels.addressLookingUp}
        />
      ) : null}

      {map.resolvedGpsAddress ? (
        <AppNotice
          tone="info"
          icon="location-outline"
          title={fr.surveyForm.parcels.addressTitle}
          message={map.resolvedGpsAddress}
        />
      ) : null}
    </AppCard>
  )
}
