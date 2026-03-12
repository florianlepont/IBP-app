import { Button, Text, TextInput, View } from 'react-native';
import { styles } from '../app/styles';

type SettingsScreenProps = {
  apiUrl: string;
  onApiUrlChange: (value: string) => void;
  onSync: () => Promise<void>;
  onPullChanges: () => Promise<void>;
  onRefreshLocalList: () => Promise<void>;
  onRefreshLocalAttachments: () => Promise<void>;
  onDebugResetIbpData: () => Promise<void>;
  onDebugResetUserData: () => Promise<void>;
  status: string;
};

export function SettingsScreen({
  apiUrl,
  onApiUrlChange,
  onSync,
  onPullChanges,
  onRefreshLocalList,
  onRefreshLocalAttachments,
  onDebugResetIbpData,
  onDebugResetUserData,
  status
}: SettingsScreenProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>API URL</Text>
      <TextInput style={styles.input} value={apiUrl} onChangeText={onApiUrlChange} autoCapitalize="none" autoCorrect={false} />

      <Button title="Sync now (push + pull)" onPress={() => void onSync()} />
      <View style={styles.spacer} />
      <Button title="Pull server changes (advanced)" onPress={() => void onPullChanges()} />
      <View style={styles.spacer} />
      <Button title="Refresh local list" onPress={() => void onRefreshLocalList()} />
      <View style={styles.spacer} />
      <Button title="Refresh local attachments" onPress={() => void onRefreshLocalAttachments()} />
      <View style={styles.spacer} />
      <Text style={styles.subtitle}>Debug</Text>
      <Button title="Debug: Clear IBP DB" onPress={() => void onDebugResetIbpData()} />
      <View style={styles.spacer} />
      <Button title="Debug: Clear User DB" onPress={() => void onDebugResetUserData()} />

      <Text style={styles.status}>{status}</Text>
    </View>
  );
}
