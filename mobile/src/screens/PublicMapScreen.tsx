import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PublicMapItem } from '../app/types';

type PublicMapScreenProps = {
  items: PublicMapItem[];
  loading: boolean;
  fromDate: string;
  toDate: string;
  region: string;
  onChangeFromDate: (value: string) => void;
  onChangeToDate: (value: string) => void;
  onChangeRegion: (value: string) => void;
  onLoad: () => Promise<void>;
};

const DEFAULT_REGION: Region = {
  latitude: 46.603354,
  longitude: 1.888334,
  latitudeDelta: 7,
  longitudeDelta: 7
};

function computeRegionFromItems(items: PublicMapItem[]): Region {
  if (items.length === 0) {
    return DEFAULT_REGION;
  }

  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;

  for (const item of items) {
    const lat = item.display_location.lat;
    const lng = item.display_location.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) {
    return DEFAULT_REGION;
  }

  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latitudeDelta = Math.max(0.08, (maxLat - minLat) * 1.4);
  const longitudeDelta = Math.max(0.08, (maxLng - minLng) * 1.4);

  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta
  };
}

export function PublicMapScreen({
  items,
  loading,
  fromDate,
  toDate,
  region,
  onChangeFromDate,
  onChangeToDate,
  onChangeRegion,
  onLoad
}: PublicMapScreenProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const insets = useSafeAreaInsets();
  const targetRegion = useMemo(() => computeRegionFromItems(items), [items]);

  useEffect(() => {
    setMapRegion(targetRegion);
  }, [targetRegion]);

  return (
    <View style={screenStyles.container}>
      <MapView style={screenStyles.map} region={mapRegion} onRegionChangeComplete={setMapRegion}>
        {items.map((item) => (
          <Marker
            key={item.survey_id}
            coordinate={{
              latitude: item.display_location.lat,
              longitude: item.display_location.lng
            }}
            pinColor="#2a7a52"
            title={`IBP ${item.ibp_total}`}
            description={`${item.region_code} - ${item.survey_date}`}
          />
        ))}
      </MapView>

      <View style={[screenStyles.topPanel, { top: insets.top + 8 }]}>
        <View style={screenStyles.topPanelHeader}>
          <View style={screenStyles.titleWrap}>
            <Ionicons name="leaf-outline" size={18} color="#1f6a49" />
            <Text style={screenStyles.title}>Explore public tags</Text>
          </View>
          <View style={screenStyles.countBadge}>
            <Text style={screenStyles.countBadgeText}>{items.length}</Text>
          </View>
        </View>

        <View style={screenStyles.actionsRow}>
          <Pressable style={screenStyles.actionButton} onPress={() => setShowFilters((current) => !current)}>
            <Ionicons name="options-outline" size={16} color="#2e5e46" />
            <Text style={screenStyles.actionButtonText}>{showFilters ? 'Hide filters' : 'Show filters'}</Text>
          </Pressable>
          <Pressable style={screenStyles.actionButtonPrimary} onPress={() => void onLoad()} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#f3fff7" /> : <Ionicons name="refresh" size={16} color="#f3fff7" />}
            <Text style={screenStyles.actionButtonPrimaryText}>{loading ? 'Loading' : 'Refresh'}</Text>
          </Pressable>
        </View>

        {showFilters ? (
          <View style={screenStyles.filtersPanel}>
            <View style={screenStyles.filtersGrid}>
              <View style={screenStyles.filterFieldHalf}>
                <Text style={screenStyles.inputLabel}>From (YYYY-MM-DD)</Text>
                <TextInput
                  style={screenStyles.input}
                  value={fromDate}
                  onChangeText={onChangeFromDate}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="2026-03-01"
                  placeholderTextColor="#809683"
                />
              </View>

              <View style={screenStyles.filterFieldHalf}>
                <Text style={screenStyles.inputLabel}>To (YYYY-MM-DD)</Text>
                <TextInput
                  style={screenStyles.input}
                  value={toDate}
                  onChangeText={onChangeToDate}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="2026-03-31"
                  placeholderTextColor="#809683"
                />
              </View>

              <View style={screenStyles.filterFieldFull}>
                <Text style={screenStyles.inputLabel}>Region (ACA or M)</Text>
                <TextInput
                  style={screenStyles.input}
                  value={region}
                  onChangeText={onChangeRegion}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="ACA"
                  placeholderTextColor="#809683"
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {!loading && items.length === 0 ? (
        <View style={[screenStyles.emptyStateCard, { bottom: Math.max(18, insets.bottom + 10) }]}>
          <Text style={screenStyles.emptyStateText}>
            No public item found. Only submitted + public surveys are included.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dfe8e0'
  },
  map: {
    ...StyleSheet.absoluteFillObject
  },
  topPanel: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c9d9ca',
    backgroundColor: 'rgba(244, 250, 244, 0.96)',
    padding: 10,
    gap: 8
  },
  topPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1f6445'
  },
  countBadge: {
    minWidth: 28,
    borderRadius: 999,
    backgroundColor: '#ddefde',
    borderWidth: 1,
    borderColor: '#b8cfbb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center'
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2b5b44'
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8
  },
  actionButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c5d7c7',
    backgroundColor: '#edf5ee',
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2d5a44'
  },
  actionButtonPrimary: {
    minWidth: 110,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2b7c53',
    backgroundColor: '#2f8258',
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  actionButtonPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f3fff7'
  },
  filtersPanel: {
    borderTopWidth: 1,
    borderTopColor: '#d2dfd3',
    paddingTop: 8,
    gap: 8
  },
  filtersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  filterFieldHalf: {
    flexGrow: 1,
    flexBasis: '48%',
    gap: 4
  },
  filterFieldFull: {
    width: '100%',
    gap: 4
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3b674f'
  },
  input: {
    borderWidth: 1,
    borderColor: '#c1d4c4',
    backgroundColor: '#edf4ee',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  emptyStateCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c5d6c7',
    backgroundColor: 'rgba(245, 250, 246, 0.96)',
    padding: 12
  },
  emptyStateText: {
    fontSize: 12,
    color: '#395d49'
  }
});
