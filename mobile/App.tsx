import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import {
  createLocalDraft,
  initLocalDb,
  listLocalSurveys,
  LocalSurvey,
  submitSurvey,
  syncPending
} from './src/storage';

const DEFAULT_API_URL = Platform.select({
  ios: 'http://localhost:3000/v1',
  android: 'http://10.0.2.2:3000/v1',
  default: 'http://localhost:3000/v1'
});

const FACTOR_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;

type LoginResponse = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    display_name: string;
    role: string;
  };
};

export default function App() {
  const initialApiUrl = useMemo(() => process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL, []);
  const [apiUrl, setApiUrl] = useState(initialApiUrl);
  const [email, setEmail] = useState('demo@ibp.local');
  const [password, setPassword] = useState('demo123');
  const [siteName, setSiteName] = useState('Foret de Rambouillet');
  const [regionVersion, setRegionVersion] = useState<'ACA' | 'M'>('ACA');
  const [vegetationStage, setVegetationStage] = useState('collineen');
  const [factorInputs, setFactorInputs] = useState<Record<string, string>>({
    A: '1', B: '1', C: '1', D: '1', E: '1', F: '1', G: '1', H: '1', I: '2', J: '2'
  });

  const [accessToken, setAccessToken] = useState('');
  const [profile, setProfile] = useState<string>('Not logged in');
  const [surveys, setSurveys] = useState<LocalSurvey[]>([]);
  const [status, setStatus] = useState<string>('Ready');

  const refreshLocalSurveys = async (): Promise<void> => {
    const rows = await listLocalSurveys();
    setSurveys(rows);
  };

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      await initLocalDb();
      await refreshLocalSurveys();
    };

    bootstrap().catch((error) => setStatus(`Init error: ${(error as Error).message}`));
  }, []);

  const handleLogin = async (): Promise<void> => {
    try {
      setStatus('Logging in...');

      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        setStatus(`Login failed: HTTP ${response.status}`);
        return;
      }

      const payload = (await response.json()) as LoginResponse;
      setAccessToken(payload.access_token);
      setProfile(`${payload.user.display_name} (${payload.user.email})`);
      setStatus('Logged in');
    } catch (error) {
      setStatus(`Login error: ${(error as Error).message}`);
    }
  };

  const handleCreateDraft = async (): Promise<void> => {
    try {
      const factors: Record<string, number> = {};
      for (const key of FACTOR_KEYS) {
        const raw = factorInputs[key]?.trim();
        if (raw) {
          factors[key] = Number(raw);
        }
      }

      await createLocalDraft({
        site_name: siteName.trim() || 'Unnamed site',
        region_version: regionVersion,
        vegetation_stage: vegetationStage.trim(),
        factors
      });

      await refreshLocalSurveys();
      setStatus('Local IBP draft created');
    } catch (error) {
      setStatus(`Draft error: ${(error as Error).message}`);
    }
  };

  const handleSync = async (): Promise<void> => {
    if (!accessToken) {
      setStatus('Login required before sync');
      return;
    }

    try {
      setStatus('Sync in progress...');
      const result = await syncPending(apiUrl, accessToken);
      await refreshLocalSurveys();
      setStatus(`Sync complete: ${result.synced} synced, ${result.failed} failed`);
    } catch (error) {
      setStatus(`Sync error: ${(error as Error).message}`);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!accessToken) {
      setStatus('Login required before submit');
      return;
    }

    const candidate = surveys.find((s) => s.sync_state === 'synced' && s.status !== 'submitted');
    if (!candidate) {
      setStatus('No synced survey available to submit');
      return;
    }

    const result = await submitSurvey(apiUrl, accessToken, candidate.id);
    await refreshLocalSurveys();
    setStatus(result.ok ? `Submitted ${candidate.id}` : `Submit failed: ${result.message}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>IBP Step 5 - Validation and Scoring</Text>
          <Text style={styles.subtitle}>API URL (editable)</Text>
          <TextInput
            style={styles.input}
            value={apiUrl}
            onChangeText={setApiUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />

          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

          <Button title="Login" onPress={handleLogin} />
          <Text style={styles.meta}>User: {profile}</Text>

          <Text style={styles.label}>Site name</Text>
          <TextInput style={styles.input} value={siteName} onChangeText={setSiteName} />

          <Text style={styles.label}>Region version (ACA or M)</Text>
          <TextInput style={styles.input} value={regionVersion} onChangeText={(v) => setRegionVersion(v === 'M' ? 'M' : 'ACA')} />

          <Text style={styles.label}>Vegetation stage</Text>
          <TextInput style={styles.input} value={vegetationStage} onChangeText={setVegetationStage} />

          <Text style={styles.label}>IBP factor scores A..J</Text>
          <View style={styles.factorGrid}>
            {FACTOR_KEYS.map((key) => (
              <View key={key} style={styles.factorItem}>
                <Text style={styles.factorKey}>{key}</Text>
                <TextInput
                  style={styles.factorInput}
                  value={factorInputs[key] ?? ''}
                  onChangeText={(value) => setFactorInputs((prev) => ({ ...prev, [key]: value }))}
                  keyboardType="numeric"
                />
              </View>
            ))}
          </View>

          <Button title="Create offline draft" onPress={handleCreateDraft} />
          <View style={styles.spacer} />
          <Button title="Sync pending drafts" onPress={handleSync} />
          <View style={styles.spacer} />
          <Button title="Submit first synced survey" onPress={handleSubmit} />
          <View style={styles.spacer} />
          <Button title="Refresh local list" onPress={refreshLocalSurveys} />

          <Text style={styles.status}>{status}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Local Surveys ({surveys.length})</Text>
          {surveys.map((survey) => (
            <View key={survey.id} style={styles.row}>
              <Text style={styles.rowTitle}>{survey.site_name}</Text>
              <Text style={styles.rowMeta}>id: {survey.id}</Text>
              <Text style={styles.rowMeta}>
                status: {survey.status} | sync: {survey.sync_state} | v{survey.sync_version}
              </Text>
              {survey.last_sync_error ? (
                <Text style={styles.rowMeta}>last error: {survey.last_sync_error}</Text>
              ) : null}
            </View>
          ))}
          {surveys.length === 0 ? <Text style={styles.meta}>No local survey yet.</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f5fa'
  },
  content: {
    padding: 16,
    gap: 14
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    gap: 10
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#12304f'
  },
  subtitle: {
    fontSize: 12,
    color: '#34516f'
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1d3e61'
  },
  input: {
    borderWidth: 1,
    borderColor: '#c8d7e6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fdfefe'
  },
  factorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  factorItem: {
    width: '18%',
    minWidth: 48
  },
  factorKey: {
    fontSize: 12,
    color: '#1d3e61',
    marginBottom: 4
  },
  factorInput: {
    borderWidth: 1,
    borderColor: '#c8d7e6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#fdfefe',
    textAlign: 'center'
  },
  status: {
    marginTop: 6,
    fontSize: 13,
    color: '#17395e'
  },
  meta: {
    fontSize: 12,
    color: '#4b6480'
  },
  spacer: {
    height: 2
  },
  row: {
    borderTopWidth: 1,
    borderTopColor: '#e6eef7',
    paddingTop: 10,
    marginTop: 6,
    gap: 2
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#17395e'
  },
  rowMeta: {
    fontSize: 12,
    color: '#55708b'
  }
});
