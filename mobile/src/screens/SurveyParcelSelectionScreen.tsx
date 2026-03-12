import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brandColors, brandRadius, brandShadow, brandTypography } from '../app/brand-tokens';
import { areRegionsNearlyEqual, computeRegionZoom } from '../app/map-viewport';
import { GpsCaptureResult } from '../app/types';
import { IgnCadastreTileOverlay } from '../components/IgnCadastreTileOverlay';
import { ParcelOverlayPolygons } from '../components/ParcelOverlayPolygons';
import { useParcelStatuses } from '../hooks/useParcelStatuses';

type SurveyParcelSelectionScreenProps = {
  apiUrl: string;
  siteName: string;
  gpsLocation: {
    lat: string;
    lng: string;
    collected_at: string;
  };
  selectedParcelIds: string[];
  onToggleParcelSelection: (parcelId: string) => void;
  onCaptureGpsLocation: () => Promise<GpsCaptureResult | null>;
  onSave: () => Promise<void>;
};

const DEFAULT_FRANCE_CENTER = { lat: 46.603354, lng: 1.888334 };
const buildFocusedMapRegion = (location: Pick<GpsCaptureResult, 'lat' | 'lng'>): Region => ({
  latitude: location.lat,
  longitude: location.lng,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015
});

export function SurveyParcelSelectionScreen({
  apiUrl,
  siteName,
  gpsLocation,
  selectedParcelIds,
  onToggleParcelSelection,
  onCaptureGpsLocation,
  onSave
}: SurveyParcelSelectionScreenProps) {
  const mapRef = useRef<MapView | null>(null);
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const parsedLat = Number(gpsLocation.lat);
  const parsedLng = Number(gpsLocation.lng);
  const hasGpsCoordinates = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
  const mapCenter = hasGpsCoordinates ? { lat: parsedLat, lng: parsedLng } : DEFAULT_FRANCE_CENTER;
  const initialRegion: Region = hasGpsCoordinates
    ? buildFocusedMapRegion(mapCenter)
    : {
        latitude: mapCenter.lat,
        longitude: mapCenter.lng,
        latitudeDelta: 3.8,
        longitudeDelta: 3.8
      };
  const [mapRegion, setMapRegion] = useState<Region>(initialRegion);
  const mapZoom = useMemo(() => computeRegionZoom(mapRegion), [mapRegion]);
  const { items: parcelStatuses, loading: parcelsLoading } = useParcelStatuses({
    apiUrl,
    region: mapRegion,
    enabled: true,
    year: new Date().getFullYear()
  });

  useEffect(() => {
    if (!hasGpsCoordinates) {
      return;
    }
    const nextRegion = buildFocusedMapRegion({ lat: parsedLat, lng: parsedLng });
    setMapRegion((current) => (areRegionsNearlyEqual(current, nextRegion) ? current : nextRegion));
    mapRef.current?.animateToRegion(nextRegion, 420);
  }, [hasGpsCoordinates, parsedLat, parsedLng, gpsLocation.collected_at]);

  const handleMapRegionChange = (nextRegion: Region): void => {
    setMapRegion((current) => (areRegionsNearlyEqual(current, nextRegion) ? current : nextRegion));
  };

  const hasParcelSelection = selectedParcelIds.length > 0;
  const parcelSelectionLabel = `${selectedParcelIds.length} parcel${selectedParcelIds.length > 1 ? 's' : ''} selected`;
  const parcelHelperText =
    mapZoom >= 15
      ? parcelsLoading
        ? 'Loading parcel overlay...'
        : `${parcelStatuses.length} visible parcel(s) · tap polygons to select or deselect`
      : 'Zoom in to unlock parcel selection';

  return (
    <View style={screenStyles.fullscreen}>
      <MapView ref={mapRef} style={screenStyles.map} initialRegion={mapRegion} onRegionChangeComplete={handleMapRegionChange}>
        <IgnCadastreTileOverlay enabled={mapZoom >= 15} zIndex={0} />
        <ParcelOverlayPolygons items={parcelStatuses} selectedParcelIds={selectedParcelIds} onParcelPress={onToggleParcelSelection} />
        {hasGpsCoordinates ? <Marker coordinate={{ latitude: parsedLat, longitude: parsedLng }} /> : null}
      </MapView>

      <View
        pointerEvents="box-none"
        style={[
          screenStyles.overlayLayer,
          {
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 12) + 12
          }
        ]}
      >
        <View style={screenStyles.topPill}>
          <Ionicons name="map-outline" size={14} color="#ffffff" />
          <Text numberOfLines={1} style={screenStyles.topPillText}>
            {siteName.trim() || 'Parcel selection'}
          </Text>
        </View>

        <View style={screenStyles.bottomArea}>
          <View style={screenStyles.floatingActions}>
            <Pressable
              style={screenStyles.locateButton}
              onPress={() => {
                void onCaptureGpsLocation().then((capturedLocation) => {
                  if (!capturedLocation) {
                    return;
                  }
                  const nextRegion = buildFocusedMapRegion(capturedLocation);
                  setMapRegion((current) => (areRegionsNearlyEqual(current, nextRegion) ? current : nextRegion));
                  mapRef.current?.animateToRegion(nextRegion, 420);
                });
              }}
            >
              <Ionicons name="locate-outline" size={18} color={brandColors.white} />
              <Text style={screenStyles.locateButtonText}>Current position</Text>
            </Pressable>
          </View>

          <View style={screenStyles.bottomSheet}>
            <Text style={screenStyles.bottomTitle}>{hasParcelSelection ? parcelSelectionLabel : 'No parcel selected yet'}</Text>
            <Text style={screenStyles.bottomMeta}>{parcelHelperText}</Text>
            {!hasParcelSelection ? (
              <View style={screenStyles.warningCard}>
                <Ionicons name="alert-circle-outline" size={18} color={brandColors.terracotta} />
                <Text style={screenStyles.warningText}>Select at least one parcel to continue.</Text>
              </View>
            ) : null}
            <Text style={screenStyles.bottomHint}>Tap polygons to add or remove parcels from this survey.</Text>
            <Pressable
              style={[screenStyles.doneButton, saving ? screenStyles.doneButtonDisabled : null]}
              onPress={() => {
                if (saving) {
                  return;
                }
                setSaving(true);
                void onSave().finally(() => setSaving(false));
              }}
              disabled={saving}
            >
              <Ionicons name={saving ? 'hourglass-outline' : 'checkmark'} size={18} color={brandColors.white} />
              <Text style={screenStyles.doneButtonText}>{saving ? 'Saving...' : 'Done'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const screenStyles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: '#132434'
  },
  map: {
    flex: 1,
    backgroundColor: '#132434'
  },
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 16
  },
  topPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(22, 47, 31, 0.76)',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  topPillText: {
    ...brandTypography.meta,
    color: brandColors.white
  },
  bottomArea: {
    gap: 12
  },
  floatingActions: {
    alignSelf: 'flex-end'
  },
  locateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#8EA97C',
    backgroundColor: brandColors.forest,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: brandRadius.pill,
    ...brandShadow.card
  },
  locateButtonText: {
    ...brandTypography.meta,
    color: brandColors.white
  },
  bottomSheet: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: 'rgba(247, 246, 240, 0.97)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
    ...brandShadow.card
  },
  bottomTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 20,
    lineHeight: 24,
    color: brandColors.forest
  },
  bottomMeta: {
    ...brandTypography.sectionBody,
    fontSize: 13,
    lineHeight: 18,
    color: brandColors.textSecondary
  },
  bottomHint: {
    ...brandTypography.meta,
    color: brandColors.textSecondary
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E7B8AA',
    backgroundColor: '#F6E1DA',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  warningText: {
    flex: 1,
    ...brandTypography.meta,
    color: brandColors.terracotta
  },
  doneButton: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.forest,
    paddingHorizontal: 18,
    paddingVertical: 14,
    ...brandShadow.card
  },
  doneButtonDisabled: {
    opacity: 0.62
  },
  doneButtonText: {
    ...brandTypography.button,
    color: brandColors.white
  }
});
