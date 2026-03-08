import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Platform,
  Pressable,
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

type FactorKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';

const HELP_BY_FACTOR: Record<FactorKey, string> = {
  A: 'Native tree taxa. Enter the observed count of native genera in the stand.',
  B: 'Vertical structure. Enter strata_count (1..5) and native cover percentage.',
  C: 'Standing deadwood. Enter BMg/BMm counts and surveyed area in hectares.',
  D: 'Downed deadwood. Enter BMg/BMm counts and surveyed area in hectares.',
  E: 'Very large living trees. Enter TGB/GB counts and surveyed area in hectares.',
  F: 'Dendromicrohabitats. Enter trees_per_ha (already capped if needed by field protocol).',
  G: 'Flowering open habitats. Enter open_flowering_percent for the described area.',
  H: 'Temporal continuity class. Use 0 (recent), 2 (partial), or 5 (ancient).',
  I: 'Aquatic habitats. Enter distinct habitat type_count: 0, 1, or 2+.',
  J: 'Rocky habitats. Enter distinct habitat type_count: 0, 1, or 2+.'
};

export default function App() {
  const initialApiUrl = useMemo(() => process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL, []);
  const [apiUrl, setApiUrl] = useState(initialApiUrl);
  const [email, setEmail] = useState('demo@ibp.local');
  const [password, setPassword] = useState('demo123');
  const [siteName, setSiteName] = useState('Foret de Rambouillet');
  const [regionVersion, setRegionVersion] = useState<'ACA' | 'M'>('ACA');
  const [vegetationStage, setVegetationStage] = useState('collineen');
  const [helpFactor, setHelpFactor] = useState<FactorKey | null>(null);

  const [factorA, setFactorA] = useState({ native_genus_count: '2' });
  const [factorB, setFactorB] = useState({ strata_count: '2', covered_autochthonous_percent: '70' });
  const [factorC, setFactorC] = useState({ bmg_count: '0', bmm_count: '0', surface_ha: '1' });
  const [factorD, setFactorD] = useState({ bmg_count: '0', bmm_count: '0', surface_ha: '1' });
  const [factorE, setFactorE] = useState({ tgb_count: '0', gb_count: '0', surface_ha: '1' });
  const [factorF, setFactorF] = useState({ trees_per_ha: '2' });
  const [factorG, setFactorG] = useState({ open_flowering_percent: '2' });
  const [factorH, setFactorH] = useState({ class_score: '2' });
  const [factorI, setFactorI] = useState({ type_count: '1' });
  const [factorJ, setFactorJ] = useState({ type_count: '1' });

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

  const toNum = (v: string): number => Number(v || '0');

  const buildFactorsPayload = (): Record<string, unknown> => ({
    A: { native_genus_count: toNum(factorA.native_genus_count) },
    B: {
      strata_count: toNum(factorB.strata_count),
      covered_autochthonous_percent: toNum(factorB.covered_autochthonous_percent)
    },
    C: {
      bmg_count: toNum(factorC.bmg_count),
      bmm_count: toNum(factorC.bmm_count),
      surface_ha: toNum(factorC.surface_ha)
    },
    D: {
      bmg_count: toNum(factorD.bmg_count),
      bmm_count: toNum(factorD.bmm_count),
      surface_ha: toNum(factorD.surface_ha)
    },
    E: {
      tgb_count: toNum(factorE.tgb_count),
      gb_count: toNum(factorE.gb_count),
      surface_ha: toNum(factorE.surface_ha)
    },
    F: { trees_per_ha: toNum(factorF.trees_per_ha) },
    G: { open_flowering_percent: toNum(factorG.open_flowering_percent) },
    H: { class_score: toNum(factorH.class_score) },
    I: { type_count: toNum(factorI.type_count) },
    J: { type_count: toNum(factorJ.type_count) }
  });

  const handleCreateDraft = async (): Promise<void> => {
    try {
      await createLocalDraft({
        site_name: siteName.trim() || 'Unnamed site',
        region_version: regionVersion,
        vegetation_stage: vegetationStage.trim(),
        factors: buildFactorsPayload()
      });

      await refreshLocalSurveys();
      setStatus('Local IBP draft created with raw observations');
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

  const renderFactorSection = (
    key: FactorKey,
    fields: Array<{ label: string; value: string; onChange: (v: string) => void }>
  ) => (
    <View style={styles.helpCard} key={key}>
      <View style={styles.helpHeader}>
        <Text style={styles.label}>Factor {key}</Text>
        <Pressable onPress={() => setHelpFactor((v) => (v === key ? null : key))}>
          <Text style={styles.helpToggle}>{helpFactor === key ? 'Hide help' : 'Show help'}</Text>
        </Pressable>
      </View>
      {helpFactor === key ? <Text style={styles.helpText}>{HELP_BY_FACTOR[key]}</Text> : null}
      <View style={styles.factorGrid}>
        {fields.map((field) => (
          <View key={`${key}-${field.label}`} style={styles.factorItemWide}>
            <Text style={styles.factorKey}>{field.label}</Text>
            <TextInput
              style={styles.factorInput}
              value={field.value}
              onChangeText={field.onChange}
              keyboardType="numeric"
            />
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>IBP Step 6.2 - Raw Observations A..J</Text>
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

          {renderFactorSection('A', [
            { label: 'native_genus_count', value: factorA.native_genus_count, onChange: (v) => setFactorA({ native_genus_count: v }) }
          ])}
          {renderFactorSection('B', [
            { label: 'strata_count', value: factorB.strata_count, onChange: (v) => setFactorB((p) => ({ ...p, strata_count: v })) },
            { label: 'covered_autochthonous_percent', value: factorB.covered_autochthonous_percent, onChange: (v) => setFactorB((p) => ({ ...p, covered_autochthonous_percent: v })) }
          ])}
          {renderFactorSection('C', [
            { label: 'bmg_count', value: factorC.bmg_count, onChange: (v) => setFactorC((p) => ({ ...p, bmg_count: v })) },
            { label: 'bmm_count', value: factorC.bmm_count, onChange: (v) => setFactorC((p) => ({ ...p, bmm_count: v })) },
            { label: 'surface_ha', value: factorC.surface_ha, onChange: (v) => setFactorC((p) => ({ ...p, surface_ha: v })) }
          ])}
          {renderFactorSection('D', [
            { label: 'bmg_count', value: factorD.bmg_count, onChange: (v) => setFactorD((p) => ({ ...p, bmg_count: v })) },
            { label: 'bmm_count', value: factorD.bmm_count, onChange: (v) => setFactorD((p) => ({ ...p, bmm_count: v })) },
            { label: 'surface_ha', value: factorD.surface_ha, onChange: (v) => setFactorD((p) => ({ ...p, surface_ha: v })) }
          ])}
          {renderFactorSection('E', [
            { label: 'tgb_count', value: factorE.tgb_count, onChange: (v) => setFactorE((p) => ({ ...p, tgb_count: v })) },
            { label: 'gb_count', value: factorE.gb_count, onChange: (v) => setFactorE((p) => ({ ...p, gb_count: v })) },
            { label: 'surface_ha', value: factorE.surface_ha, onChange: (v) => setFactorE((p) => ({ ...p, surface_ha: v })) }
          ])}
          {renderFactorSection('F', [
            { label: 'trees_per_ha', value: factorF.trees_per_ha, onChange: (v) => setFactorF({ trees_per_ha: v }) }
          ])}
          {renderFactorSection('G', [
            { label: 'open_flowering_percent', value: factorG.open_flowering_percent, onChange: (v) => setFactorG({ open_flowering_percent: v }) }
          ])}
          {renderFactorSection('H', [
            { label: 'class_score (0|2|5)', value: factorH.class_score, onChange: (v) => setFactorH({ class_score: v }) }
          ])}
          {renderFactorSection('I', [
            { label: 'type_count', value: factorI.type_count, onChange: (v) => setFactorI({ type_count: v }) }
          ])}
          {renderFactorSection('J', [
            { label: 'type_count', value: factorJ.type_count, onChange: (v) => setFactorJ({ type_count: v }) }
          ])}

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
  factorItemWide: {
    width: '31%',
    minWidth: 90
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
  helpCard: {
    borderWidth: 1,
    borderColor: '#e4ebf3',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    backgroundColor: '#f9fbfe'
  },
  helpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  helpToggle: {
    fontSize: 12,
    color: '#1a5ea8',
    fontWeight: '600'
  },
  helpText: {
    fontSize: 12,
    color: '#405b78'
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
