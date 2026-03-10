import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { MapPressEvent, Marker, MarkerDragStartEndEvent } from 'react-native-maps';
import { styles } from '../app/styles';
import { SurveyLocationSource } from '../app/types';
import { FilterChip } from '../components/FilterChip';

type SurveyLocationScreenProps = {
  surveyId: string;
  locationSource: SurveyLocationSource;
  setLocationSource: (value: SurveyLocationSource) => void;
  gpsLocation: {
    lat: string;
    lng: string;
    accuracy_m: string;
    collected_at: string;
  };
  manualLocation: {
    address_line: string;
    postal_code: string;
    city: string;
    country: string;
  };
  setGpsLocationField: (field: 'lat' | 'lng' | 'accuracy_m' | 'collected_at', value: string) => void;
  setManualLocationField: (field: 'address_line' | 'postal_code' | 'city' | 'country', value: string) => void;
  onCaptureGpsLocation: () => Promise<void>;
  formErrors: {
    gps: {
      lat: string | null;
      lng: string | null;
    };
    manual: {
      address_line: string | null;
      postal_code: string | null;
      city: string | null;
      country: string | null;
    };
  };
  status: string;
};

const DEFAULT_FRANCE_CENTER = { lat: 46.603354, lng: 1.888334 };
type LocationViewMode = 'gps' | 'coordinates' | 'manual';

const toAddressLabel = (item: Record<string, unknown>): string => {
  const streetNumber = typeof item.streetNumber === 'string' ? item.streetNumber.trim() : '';
  const street = typeof item.street === 'string' ? item.street.trim() : '';
  const postalCode = typeof item.postalCode === 'string' ? item.postalCode.trim() : '';
  const city = typeof item.city === 'string' ? item.city.trim() : '';
  const region = typeof item.region === 'string' ? item.region.trim() : '';
  const country = typeof item.country === 'string' ? item.country.trim() : '';

  const line1 = [streetNumber, street].filter((part) => part.length > 0).join(' ');
  const line2 = [postalCode, city].filter((part) => part.length > 0).join(' ');
  const line3 = [region, country].filter((part) => part.length > 0).join(', ');
  return [line1, line2, line3].filter((part) => part.length > 0).join(' - ');
};

export function SurveyLocationScreen({
  surveyId,
  locationSource,
  setLocationSource,
  gpsLocation,
  manualLocation,
  setGpsLocationField,
  setManualLocationField,
  onCaptureGpsLocation,
  formErrors,
  status
}: SurveyLocationScreenProps) {
  const [locationViewMode, setLocationViewMode] = useState<LocationViewMode>(locationSource === 'manual' ? 'manual' : 'gps');
  const [resolvedGpsAddress, setResolvedGpsAddress] = useState('');
  const [isResolvingGpsAddress, setIsResolvingGpsAddress] = useState(false);
  const lastResolvedCoordinateKeyRef = useRef('');

  const parsedLat = Number(gpsLocation.lat);
  const parsedLng = Number(gpsLocation.lng);
  const hasGpsCoordinates = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
  const mapCenter = hasGpsCoordinates ? { lat: parsedLat, lng: parsedLng } : DEFAULT_FRANCE_CENTER;
  const mapRegion = {
    latitude: mapCenter.lat,
    longitude: mapCenter.lng,
    latitudeDelta: hasGpsCoordinates ? 0.02 : 3.8,
    longitudeDelta: hasGpsCoordinates ? 0.02 : 3.8
  };

  const handleMapPress = (event: MapPressEvent): void => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setLocationSource('gps');
    setGpsLocationField('lat', latitude.toFixed(6));
    setGpsLocationField('lng', longitude.toFixed(6));
    if (!gpsLocation.collected_at) {
      setGpsLocationField('collected_at', new Date().toISOString());
    }
  };

  const handleMarkerDragEnd = (event: MarkerDragStartEndEvent): void => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setGpsLocationField('lat', latitude.toFixed(6));
    setGpsLocationField('lng', longitude.toFixed(6));
  };

  useEffect(() => {
    if (locationSource === 'manual' && locationViewMode !== 'manual') {
      setLocationViewMode('manual');
    }
  }, [locationSource, locationViewMode]);

  useEffect(() => {
    if (locationSource !== 'gps' || !hasGpsCoordinates) {
      setResolvedGpsAddress('');
      setIsResolvingGpsAddress(false);
      return;
    }

    const coordinateKey = `${parsedLat.toFixed(5)},${parsedLng.toFixed(5)}`;
    if (lastResolvedCoordinateKeyRef.current === coordinateKey) {
      return;
    }
    lastResolvedCoordinateKeyRef.current = coordinateKey;

    let cancelled = false;
    const run = async (): Promise<void> => {
      try {
        setIsResolvingGpsAddress(true);
        const Location = await import('expo-location');
        const matches = await Location.reverseGeocodeAsync({
          latitude: parsedLat,
          longitude: parsedLng
        });
        if (cancelled) return;
        const first = matches[0] as Record<string, unknown> | undefined;
        if (!first) {
          setResolvedGpsAddress('Adresse locale non disponible');
          return;
        }
        const label = toAddressLabel(first);
        setResolvedGpsAddress(label || 'Adresse locale non disponible');
      } catch (_error) {
        if (!cancelled) {
          setResolvedGpsAddress('Adresse locale non disponible');
        }
      } finally {
        if (!cancelled) {
          setIsResolvingGpsAddress(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [locationSource, hasGpsCoordinates, parsedLat, parsedLng]);

  return (
    <View style={styles.card}>
      <Text style={styles.meta}>Survey id: {surveyId}</Text>
      <Text style={styles.rowMeta}>Changes are saved automatically.</Text>
      <Text style={styles.label}>Location source</Text>
      <View style={styles.filterChipsRow}>
        <FilterChip
          label="GPS"
          active={locationViewMode === 'gps'}
          onPress={() => {
            setLocationViewMode('gps');
            setLocationSource('gps');
          }}
        />
        <FilterChip
          label="Coordinates"
          active={locationViewMode === 'coordinates'}
          onPress={() => {
            setLocationViewMode('coordinates');
            setLocationSource('gps');
          }}
        />
        <FilterChip
          label="Manual address"
          active={locationViewMode === 'manual'}
          onPress={() => {
            setLocationViewMode('manual');
            setLocationSource('manual');
          }}
        />
      </View>

      {locationViewMode === 'gps' ? (
        <View style={styles.detailSection}>
          <View style={styles.formMapCard}>
            <View style={styles.formMapFrame}>
              <MapView style={styles.formMap} region={mapRegion} onPress={handleMapPress}>
                {hasGpsCoordinates ? <Marker coordinate={{ latitude: parsedLat, longitude: parsedLng }} draggable onDragEnd={handleMarkerDragEnd} /> : null}
              </MapView>
              <Pressable style={styles.locationCurrentMapButton} onPress={() => void onCaptureGpsLocation()}>
                <Ionicons name="locate" size={14} color="#ffffff" />
                <Text style={styles.locationCurrentMapButtonText}>Current location</Text>
              </Pressable>
            </View>
            <Text style={styles.rowMeta}>Tap map to adjust. Drag marker for fine tuning.</Text>
            {isResolvingGpsAddress ? (
              <View style={styles.locationAddressCard}>
                <View style={styles.locationAddressHeader}>
                  <Ionicons name="navigate-outline" size={14} color="#1f5d8e" />
                  <Text style={styles.locationAddressLabel}>Local address</Text>
                </View>
                <Text style={styles.locationAddressValue}>Looking up...</Text>
              </View>
            ) : null}
            {resolvedGpsAddress ? (
              <View style={styles.locationAddressCard}>
                <View style={styles.locationAddressHeader}>
                  <Ionicons name="location-outline" size={14} color="#1f5d8e" />
                  <Text style={styles.locationAddressLabel}>Local address</Text>
                </View>
                <Text style={styles.locationAddressValue}>{resolvedGpsAddress}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : locationViewMode === 'coordinates' ? (
        <View style={styles.detailSection}>
          <Text style={styles.rowMeta}>Enter latitude and longitude manually.</Text>
          <Text style={styles.label}>Latitude *</Text>
          <TextInput
            style={styles.input}
            value={gpsLocation.lat}
            onChangeText={(value) => setGpsLocationField('lat', value)}
            keyboardType="decimal-pad"
            placeholder="48.8566"
          />
          <Text style={styles.label}>Longitude *</Text>
          <TextInput
            style={styles.input}
            value={gpsLocation.lng}
            onChangeText={(value) => setGpsLocationField('lng', value)}
            keyboardType="decimal-pad"
            placeholder="2.3522"
          />
          <Pressable style={styles.mediaAddPictureButton} onPress={() => void onCaptureGpsLocation()}>
            <Ionicons name="locate" size={15} color="#255178" />
            <Text style={styles.mediaAddPictureButtonText}>Use current location</Text>
          </Pressable>
          {resolvedGpsAddress ? (
            <View style={styles.locationAddressCard}>
              <View style={styles.locationAddressHeader}>
                <Ionicons name="location-outline" size={14} color="#1f5d8e" />
                <Text style={styles.locationAddressLabel}>Local address</Text>
              </View>
              <Text style={styles.locationAddressValue}>{resolvedGpsAddress}</Text>
            </View>
          ) : null}
          {formErrors.gps.lat || formErrors.gps.lng ? (
            <Text style={styles.fieldError}>{formErrors.gps.lat ?? formErrors.gps.lng}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.detailSection}>
          <Text style={styles.rowMeta}>Manual address is required when GPS is unavailable.</Text>
          <Text style={styles.label}>Address line *</Text>
          <TextInput
            style={styles.input}
            value={manualLocation.address_line}
            onChangeText={(value) => setManualLocationField('address_line', value)}
            placeholder="12 Rue de la Foret"
          />
          {formErrors.manual.address_line ? <Text style={styles.fieldError}>{formErrors.manual.address_line}</Text> : null}

          <Text style={styles.label}>Postal code *</Text>
          <TextInput
            style={styles.input}
            value={manualLocation.postal_code}
            onChangeText={(value) => setManualLocationField('postal_code', value)}
            keyboardType="number-pad"
            placeholder="75001"
          />
          {formErrors.manual.postal_code ? <Text style={styles.fieldError}>{formErrors.manual.postal_code}</Text> : null}

          <Text style={styles.label}>City *</Text>
          <TextInput style={styles.input} value={manualLocation.city} onChangeText={(value) => setManualLocationField('city', value)} placeholder="Paris" />
          {formErrors.manual.city ? <Text style={styles.fieldError}>{formErrors.manual.city}</Text> : null}

          <Text style={styles.label}>Country *</Text>
          <TextInput style={styles.input} value={manualLocation.country} onChangeText={(value) => setManualLocationField('country', value)} placeholder="France" />
          {formErrors.manual.country ? <Text style={styles.fieldError}>{formErrors.manual.country}</Text> : null}
        </View>
      )}

      <Text style={styles.status}>{status}</Text>
    </View>
  );
}
