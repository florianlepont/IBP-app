import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Text, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { computeRegionZoom } from '../app/map-viewport';
import { styles } from '../app/styles';
import { IgnCadastreTileOverlay } from '../components/IgnCadastreTileOverlay';
import { ParcelOverlayPolygons } from '../components/ParcelOverlayPolygons';
import { useParcelStatuses } from '../hooks/useParcelStatuses';

type SurveyParcelSelectionScreenProps = {
  apiUrl: string;
  surveyId: string;
  siteName: string;
  gpsLocation: {
    lat: string;
    lng: string;
    collected_at: string;
  };
  selectedParcelIds: string[];
  onToggleParcelSelection: (parcelId: string) => void;
  onCaptureGpsLocation: () => Promise<void>;
  onSave: () => Promise<void>;
  status: string;
};

const DEFAULT_FRANCE_CENTER = { lat: 46.603354, lng: 1.888334 };

export function SurveyParcelSelectionScreen({
  apiUrl,
  surveyId,
  siteName,
  gpsLocation,
  selectedParcelIds,
  onToggleParcelSelection,
  onCaptureGpsLocation,
  onSave,
  status
}: SurveyParcelSelectionScreenProps) {
  const mapRef = useRef<MapView | null>(null);
  const [saving, setSaving] = useState(false);
  const parsedLat = Number(gpsLocation.lat);
  const parsedLng = Number(gpsLocation.lng);
  const hasGpsCoordinates = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
  const mapCenter = hasGpsCoordinates ? { lat: parsedLat, lng: parsedLng } : DEFAULT_FRANCE_CENTER;
  const initialRegion: Region = {
    latitude: mapCenter.lat,
    longitude: mapCenter.lng,
    latitudeDelta: hasGpsCoordinates ? 0.02 : 3.8,
    longitudeDelta: hasGpsCoordinates ? 0.02 : 3.8
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
    const nextRegion: Region = {
      latitude: parsedLat,
      longitude: parsedLng,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015
    };
    setMapRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 420);
  }, [hasGpsCoordinates, parsedLat, parsedLng, gpsLocation.collected_at]);

  return (
    <View style={styles.parcelEditorScreen}>
      <View style={styles.parcelEditorMapCard}>
        <MapView ref={mapRef} style={styles.parcelEditorMap} initialRegion={mapRegion} onRegionChangeComplete={setMapRegion}>
          <IgnCadastreTileOverlay enabled={mapZoom >= 15} zIndex={0} />
          <ParcelOverlayPolygons items={parcelStatuses} selectedParcelIds={selectedParcelIds} onParcelPress={onToggleParcelSelection} />
          {hasGpsCoordinates ? <Marker coordinate={{ latitude: parsedLat, longitude: parsedLng }} /> : null}
        </MapView>
      </View>

      <View style={styles.parcelEditorInfoCard}>
        <Text style={styles.meta}>Survey id: {surveyId}</Text>
        <Text style={styles.detailTitle}>{siteName}</Text>
        <Text style={styles.rowMeta}>
          {mapZoom >= 15
            ? parcelsLoading
              ? 'Loading parcel overlay...'
              : `${parcelStatuses.length} visible parcel(s) • ${selectedParcelIds.length} selected`
            : 'Zoom in (>=15) then tap parcel polygons to select/deselect'}
        </Text>

        <View style={styles.actionButtonsRow}>
          <Button title="Center on current location" onPress={() => void onCaptureGpsLocation()} />
          <Button
            title={saving ? 'Saving...' : 'Save parcels'}
            onPress={() => {
              if (saving) return;
              setSaving(true);
              void onSave().finally(() => setSaving(false));
            }}
          />
        </View>
        <View style={styles.parcelEditorHintRow}>
          <Ionicons name="information-circle-outline" size={14} color="#3f5c79" />
          <Text style={styles.rowMeta}>Tap one parcel to add/remove it from this survey.</Text>
        </View>
        <Text style={styles.status}>{status}</Text>
      </View>
    </View>
  );
}
