import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PublicMapItem } from '../app/types';

type PublicMapScreenProps = {
  items: PublicMapItem[];
  ownSurveyIds: string[];
  loading: boolean;
  fromDate: string;
  toDate: string;
  region: string;
  onChangeFromDate: (value: string) => void;
  onChangeToDate: (value: string) => void;
  onChangeRegion: (value: string) => void;
  onLoad: () => Promise<void>;
  onReportSurvey: (surveyId: string, reason: string) => Promise<{ ok: boolean; message: string }>;
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
  ownSurveyIds,
  loading,
  fromDate,
  toDate,
  region,
  onChangeFromDate,
  onChangeToDate,
  onChangeRegion,
  onLoad,
  onReportSurvey
}: PublicMapScreenProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const [selectedItem, setSelectedItem] = useState<PublicMapItem | null>(null);
  const [reportPanelOpen, setReportPanelOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const ownSurveyIdSet = useMemo(() => new Set(ownSurveyIds), [ownSurveyIds]);
  const targetRegion = useMemo(() => computeRegionFromItems(items), [items]);
  const selectedItemIsOwnSurvey = selectedItem ? ownSurveyIdSet.has(selectedItem.survey_id) : false;

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
            onPress={() => {
              setSelectedItem(item);
              setReportPanelOpen(false);
              setReportReason('');
              setReportMessage(null);
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

      {selectedItem ? (
        <View style={[screenStyles.reportCard, { bottom: Math.max(84, insets.bottom + 62) }]}>
          <View style={screenStyles.reportHeaderRow}>
            <Text style={screenStyles.reportTitle}>Survey {selectedItem.survey_id}</Text>
            <Pressable onPress={() => setSelectedItem(null)}>
              <Ionicons name="close" size={18} color="#40654f" />
            </Pressable>
          </View>
          <Text style={screenStyles.reportMeta}>
            {selectedItem.region_code} · {selectedItem.survey_date} · IBP {selectedItem.ibp_total}
          </Text>

          {selectedItemIsOwnSurvey ? (
            <View style={screenStyles.reportOwnSurveyInfo}>
              <Ionicons name="information-circle-outline" size={14} color="#40654f" />
              <Text style={screenStyles.reportOwnSurveyInfoText}>You cannot report your own survey.</Text>
            </View>
          ) : !reportPanelOpen ? (
            <Pressable style={screenStyles.reportOpenButton} onPress={() => setReportPanelOpen(true)}>
              <Ionicons name="flag-outline" size={14} color="#6e3f1a" />
              <Text style={screenStyles.reportOpenButtonText}>Report this survey</Text>
            </Pressable>
          ) : (
            <View style={screenStyles.reportForm}>
              <Text style={screenStyles.inputLabel}>Reason (required)</Text>
              <TextInput
                style={screenStyles.reportInput}
                value={reportReason}
                onChangeText={setReportReason}
                autoCapitalize="sentences"
                autoCorrect
                multiline
                numberOfLines={3}
                placeholder="Explain why this survey looks suspicious"
                placeholderTextColor="#8a9287"
              />
              <View style={screenStyles.reportActionsRow}>
                <Pressable
                  style={screenStyles.reportCancelButton}
                  onPress={() => {
                    setReportPanelOpen(false);
                    setReportReason('');
                    setReportMessage(null);
                  }}
                  disabled={reportSending}
                >
                  <Text style={screenStyles.reportCancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[screenStyles.reportSubmitButton, reportSending ? screenStyles.reportSubmitButtonDisabled : null]}
                  disabled={reportSending}
                  onPress={() => {
                    if (reportSending) return;
                    setReportSending(true);
                    void onReportSurvey(selectedItem.survey_id, reportReason)
                      .then((result) => {
                        setReportMessage(result.message);
                        if (result.ok) {
                          setReportPanelOpen(false);
                          setReportReason('');
                        }
                      })
                      .finally(() => setReportSending(false));
                  }}
                >
                  <Text style={screenStyles.reportSubmitButtonText}>{reportSending ? 'Sending...' : 'Send report'}</Text>
                </Pressable>
              </View>
              {reportMessage ? <Text style={screenStyles.reportMessage}>{reportMessage}</Text> : null}
            </View>
          )}
        </View>
      ) : null}

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
  reportCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c9d7ca',
    backgroundColor: 'rgba(245, 250, 246, 0.97)',
    padding: 10,
    gap: 8
  },
  reportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  reportTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2d5a44'
  },
  reportMeta: {
    fontSize: 11,
    color: '#486956'
  },
  reportOpenButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2c2a3',
    backgroundColor: '#fbefe3',
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  reportOpenButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#74441e'
  },
  reportOwnSurveyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c8d9cb',
    backgroundColor: '#eaf2ea',
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  reportOwnSurveyInfoText: {
    fontSize: 12,
    color: '#355544'
  },
  reportForm: {
    gap: 8
  },
  reportInput: {
    borderWidth: 1,
    borderColor: '#cad3ca',
    backgroundColor: '#f4f8f4',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 72,
    textAlignVertical: 'top'
  },
  reportActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8
  },
  reportCancelButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c8d5ca',
    backgroundColor: '#edf4ee',
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  reportCancelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b6657'
  },
  reportSubmitButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#7e3f11',
    backgroundColor: '#94501b',
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  reportSubmitButtonDisabled: {
    borderColor: '#a7adb0',
    backgroundColor: '#b8bdc0'
  },
  reportSubmitButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff7f2'
  },
  reportMessage: {
    fontSize: 11,
    color: '#4e6656'
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
