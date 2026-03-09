import { Button, Text, TextInput, View } from 'react-native';
import { PublicMapItem } from '../app/types';
import { styles } from '../app/styles';

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
  onBack: () => void;
};

export function PublicMapScreen({
  items,
  loading,
  fromDate,
  toDate,
  region,
  onChangeFromDate,
  onChangeToDate,
  onChangeRegion,
  onLoad,
  onBack
}: PublicMapScreenProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.meta}>Only `submitted + public` surveys are exposed here.</Text>

      <Text style={styles.label}>From (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        value={fromDate}
        onChangeText={onChangeFromDate}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="2026-03-01"
      />

      <Text style={styles.label}>To (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        value={toDate}
        onChangeText={onChangeToDate}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="2026-03-31"
      />

      <Text style={styles.label}>Region (ACA or M)</Text>
      <TextInput
        style={styles.input}
        value={region}
        onChangeText={onChangeRegion}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="ACA"
      />

      <Button title={loading ? 'Loading...' : 'Load public items'} onPress={() => void onLoad()} disabled={loading} />
      <View style={styles.spacer} />
      <Button title="Back to local surveys" onPress={onBack} />

      <Text style={styles.meta}>Items: {items.length}</Text>
      {items.length === 0 ? <Text style={styles.meta}>No public map item found for current filters.</Text> : null}

      {items.map((item) => (
        <View key={item.survey_id} style={styles.row}>
          <Text style={styles.rowTitle}>{item.survey_id}</Text>
          <Text style={styles.rowMeta}>
            location: {item.display_location.lat}, {item.display_location.lng}
          </Text>
          <Text style={styles.rowMeta}>date: {item.survey_date}</Text>
          <Text style={styles.rowMeta}>region: {item.region_code}</Text>
          <Text style={styles.rowMeta}>IBP total: {item.ibp_total}</Text>
        </View>
      ))}
    </View>
  );
}
