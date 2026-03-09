import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  createLocalDraft,
  initLocalDb,
  listLocalAttachments,
  listLocalSurveys,
  getLocalSurveyDraft,
  LocalAttachment,
  LocalSurvey,
  pullRemoteChanges,
  queueLocalAttachment,
  queueDeleteSurvey,
  retrySurveyNow,
  discardSurveyLocalChanges,
  updateLocalDraft,
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
type FactorClass = 'S0' | 'S1' | 'S2' | 'S5';

type FactorCanonical = {
  factor_id: string;
  observed_value_raw: unknown;
  selected_class: FactorClass;
  score_points: number;
  warnings: string[];
};

type SurveyDetailResponse = {
  id: string;
  factor_results: Record<string, FactorCanonical>;
  scores: {
    ibp_peuplement_gestion: number;
    ibp_contexte: number;
    ibp_total: number;
  };
};

type SurveyDetailTab = 'summary' | 'factors' | 'photos' | 'events';

type SurveyEventItem = {
  id: string;
  survey_id?: string;
  actor_id?: string | null;
  event_type: string;
  payload?: Record<string, unknown> | null;
  created_at: string;
};

type SurveyEventsResponse = {
  items?: SurveyEventItem[];
};

type SurveyStatusFilter = 'all' | 'draft' | 'submitted';
type SurveySyncFilter = 'all' | 'pending' | 'synced' | 'failed';
type SurveyBlockedFilter = 'all' | 'blocked' | 'unblocked';
type SurveyAttachmentFilter = 'all' | 'with' | 'without';
type SurveySort = 'updated_desc' | 'updated_asc' | 'site_asc';
type AppScreen = 'list' | 'create' | 'edit';
type RegionVersion = 'ACA' | 'M';
type VegetationStage =
  | 'planitiaire'
  | 'collineen'
  | 'montagnard'
  | 'subalpin'
  | 'thermo_mediterraneen'
  | 'meso_mediterraneen'
  | 'supra_mediterraneen';

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

const REGION_OPTIONS: Array<{ value: RegionVersion; label: string }> = [
  { value: 'ACA', label: 'Régions atlantique, continentale et alpine' },
  { value: 'M', label: 'Méditerranéenne' }
];

const VEGETATION_STAGE_OPTIONS_BY_REGION: Record<RegionVersion, Array<{ value: VegetationStage; label: string }>> = {
  ACA: [
    { value: 'planitiaire', label: 'Planitiaire' },
    { value: 'collineen', label: 'Collinéen' },
    { value: 'montagnard', label: 'Montagnard' },
    { value: 'subalpin', label: 'Subalpin' }
  ],
  M: [
    { value: 'thermo_mediterraneen', label: 'Thermo-méditerranéen' },
    { value: 'meso_mediterraneen', label: 'Méso-méditerranéen' },
    { value: 'supra_mediterraneen', label: 'Supra-méditerranéen' }
  ]
};

const defaultVegetationStageForRegion = (region: RegionVersion): VegetationStage =>
  VEGETATION_STAGE_OPTIONS_BY_REGION[region][0].value;

const normalizeVegetationStageForRegion = (region: RegionVersion, stage: unknown): VegetationStage => {
  if (typeof stage !== 'string') {
    return defaultVegetationStageForRegion(region);
  }
  if (region === 'ACA' && stage === 'montagnard_mediterraneen') {
    return 'montagnard';
  }
  const match = VEGETATION_STAGE_OPTIONS_BY_REGION[region].find((option) => option.value === stage);
  return match ? match.value : defaultVegetationStageForRegion(region);
};

export default function App() {
  const initialApiUrl = useMemo(() => process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL, []);
  const [apiUrl, setApiUrl] = useState(initialApiUrl);
  const [email, setEmail] = useState('demo@ibp.local');
  const [password, setPassword] = useState('demo123');
  const [siteName, setSiteName] = useState('Foret de Rambouillet');
  const [regionVersion, setRegionVersion] = useState<RegionVersion>('ACA');
  const [vegetationStage, setVegetationStage] = useState<VegetationStage>('collineen');

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
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);
  const [surveyDetails, setSurveyDetails] = useState<Record<string, SurveyDetailResponse>>({});
  const [detailsLoadingSurveyId, setDetailsLoadingSurveyId] = useState<string | null>(null);
  const [surveyEvents, setSurveyEvents] = useState<Record<string, SurveyEventItem[]>>({});
  const [eventsLoadingSurveyId, setEventsLoadingSurveyId] = useState<string | null>(null);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [surveyDetailTab, setSurveyDetailTab] = useState<SurveyDetailTab>('summary');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [screen, setScreen] = useState<AppScreen>('list');
  const [status, setStatus] = useState<string>('Ready');
  const [surveyQuery, setSurveyQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SurveyStatusFilter>('all');
  const [syncFilter, setSyncFilter] = useState<SurveySyncFilter>('all');
  const [blockedFilter, setBlockedFilter] = useState<SurveyBlockedFilter>('all');
  const [attachmentFilter, setAttachmentFilter] = useState<SurveyAttachmentFilter>('all');
  const [sortMode, setSortMode] = useState<SurveySort>('updated_desc');

  const refreshLocalSurveys = async (): Promise<void> => {
    const rows = await listLocalSurveys();
    setSurveys(rows);
  };

  const refreshLocalAttachments = async (): Promise<void> => {
    const rows = await listLocalAttachments();
    setAttachments(rows);
  };

  const attachmentsBySurvey = useMemo(() => {
    const grouped: Record<string, LocalAttachment[]> = {};
    for (const attachment of attachments) {
      if (!grouped[attachment.survey_id]) {
        grouped[attachment.survey_id] = [];
      }
      grouped[attachment.survey_id].push(attachment);
    }
    return grouped;
  }, [attachments]);

  const attachmentCountBySurvey = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const attachment of attachments) {
      counts[attachment.survey_id] = (counts[attachment.survey_id] ?? 0) + 1;
    }
    return counts;
  }, [attachments]);

  const surveyStats = useMemo(() => {
    let draft = 0;
    let submitted = 0;
    let pending = 0;
    let synced = 0;
    let failed = 0;
    let blocked = 0;

    for (const survey of surveys) {
      if (survey.status === 'submitted') submitted += 1;
      if (survey.status === 'draft') draft += 1;
      if (survey.sync_state === 'pending') pending += 1;
      if (survey.sync_state === 'synced') synced += 1;
      if (survey.sync_state === 'failed') failed += 1;
      if (survey.sync_blocked === 1) blocked += 1;
    }

    return {
      total: surveys.length,
      draft,
      submitted,
      pending,
      synced,
      failed,
      blocked
    };
  }, [surveys]);

  const visibleSurveys = useMemo(() => {
    const query = surveyQuery.trim().toLowerCase();
    const parseDate = (value: string): number => {
      const timestamp = Date.parse(value);
      return Number.isFinite(timestamp) ? timestamp : 0;
    };

    const filtered = surveys.filter((survey) => {
      if (statusFilter !== 'all' && survey.status !== statusFilter) return false;
      if (syncFilter !== 'all' && survey.sync_state !== syncFilter) return false;

      const isBlocked = survey.sync_blocked === 1;
      if (blockedFilter === 'blocked' && !isBlocked) return false;
      if (blockedFilter === 'unblocked' && isBlocked) return false;

      const attachmentCount = attachmentCountBySurvey[survey.id] ?? 0;
      if (attachmentFilter === 'with' && attachmentCount === 0) return false;
      if (attachmentFilter === 'without' && attachmentCount > 0) return false;

      if (query.length > 0) {
        const haystack = `${survey.site_name} ${survey.id} ${survey.last_sync_error ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });

    const sorted = [...filtered];
    if (sortMode === 'site_asc') {
      sorted.sort((a, b) => a.site_name.localeCompare(b.site_name));
      return sorted;
    }

    if (sortMode === 'updated_asc') {
      sorted.sort((a, b) => parseDate(a.updated_at) - parseDate(b.updated_at));
      return sorted;
    }

    sorted.sort((a, b) => parseDate(b.updated_at) - parseDate(a.updated_at));
    return sorted;
  }, [surveys, surveyQuery, statusFilter, syncFilter, blockedFilter, attachmentFilter, sortMode, attachmentCountBySurvey]);

  const selectedSurvey = useMemo(
    () => (selectedSurveyId ? surveys.find((survey) => survey.id === selectedSurveyId) ?? null : null),
    [surveys, selectedSurveyId]
  );

  const selectedSurveyAttachments = useMemo(
    () => (selectedSurvey ? attachmentsBySurvey[selectedSurvey.id] ?? [] : []),
    [selectedSurvey, attachmentsBySurvey]
  );

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      await initLocalDb();
      await refreshLocalSurveys();
      await refreshLocalAttachments();
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
  const toTextNum = (value: unknown, fallback = '0'): string => {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'string' && value.trim().length > 0) return value;
    return fallback;
  };
  const asObject = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

  const handleRegionChange = (nextRegion: RegionVersion): void => {
    setRegionVersion(nextRegion);
    setVegetationStage((current) => normalizeVegetationStageForRegion(nextRegion, current));
  };

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

  const applyDraftToForm = (draftValue: unknown): void => {
    const draft = asObject(draftValue);
    setSiteName(typeof draft.site_name === 'string' ? draft.site_name : siteName);
    const nextRegion: RegionVersion = draft.region_version === 'M' ? 'M' : 'ACA';
    setRegionVersion(nextRegion);
    setVegetationStage(normalizeVegetationStageForRegion(nextRegion, draft.vegetation_stage));

    const factors = asObject(draft.factors);
    const factorAObj = asObject(factors.A);
    const factorBObj = asObject(factors.B);
    const factorCObj = asObject(factors.C);
    const factorDObj = asObject(factors.D);
    const factorEObj = asObject(factors.E);
    const factorFObj = asObject(factors.F);
    const factorGObj = asObject(factors.G);
    const factorHObj = asObject(factors.H);
    const factorIObj = asObject(factors.I);
    const factorJObj = asObject(factors.J);

    setFactorA({ native_genus_count: toTextNum(factorAObj.native_genus_count) });
    setFactorB({
      strata_count: toTextNum(factorBObj.strata_count),
      covered_autochthonous_percent: toTextNum(factorBObj.covered_autochthonous_percent)
    });
    setFactorC({
      bmg_count: toTextNum(factorCObj.bmg_count),
      bmm_count: toTextNum(factorCObj.bmm_count),
      surface_ha: toTextNum(factorCObj.surface_ha, '1')
    });
    setFactorD({
      bmg_count: toTextNum(factorDObj.bmg_count),
      bmm_count: toTextNum(factorDObj.bmm_count),
      surface_ha: toTextNum(factorDObj.surface_ha, '1')
    });
    setFactorE({
      tgb_count: toTextNum(factorEObj.tgb_count),
      gb_count: toTextNum(factorEObj.gb_count),
      surface_ha: toTextNum(factorEObj.surface_ha, '1')
    });
    setFactorF({ trees_per_ha: toTextNum(factorFObj.trees_per_ha) });
    setFactorG({ open_flowering_percent: toTextNum(factorGObj.open_flowering_percent) });
    setFactorH({ class_score: toTextNum(factorHObj.class_score, '2') });
    setFactorI({ type_count: toTextNum(factorIObj.type_count, '1') });
    setFactorJ({ type_count: toTextNum(factorJObj.type_count, '1') });
  };

  const resetSurveyForm = (): void => {
    setSiteName('Foret de Rambouillet');
    setRegionVersion('ACA');
    setVegetationStage(defaultVegetationStageForRegion('ACA'));
    setFactorA({ native_genus_count: '2' });
    setFactorB({ strata_count: '2', covered_autochthonous_percent: '70' });
    setFactorC({ bmg_count: '0', bmm_count: '0', surface_ha: '1' });
    setFactorD({ bmg_count: '0', bmm_count: '0', surface_ha: '1' });
    setFactorE({ tgb_count: '0', gb_count: '0', surface_ha: '1' });
    setFactorF({ trees_per_ha: '2' });
    setFactorG({ open_flowering_percent: '2' });
    setFactorH({ class_score: '2' });
    setFactorI({ type_count: '1' });
    setFactorJ({ type_count: '1' });
  };

  const handleOpenCreateSurvey = (): void => {
    setEditingSurveyId(null);
    setSelectedSurveyId(null);
    resetSurveyForm();
    setScreen('create');
    setStatus('Create survey view opened');
  };

  const handleCreateDraft = async (): Promise<void> => {
    try {
      const created = await createLocalDraft({
        site_name: siteName.trim() || 'Unnamed site',
        region_version: regionVersion,
        vegetation_stage: vegetationStage,
        factors: buildFactorsPayload()
      });

      await refreshLocalSurveys();
      await refreshLocalAttachments();
      setEditingSurveyId(null);
      setSelectedSurveyId(created.id);
      setScreen('list');
      setStatus('Local IBP draft created with raw observations');
    } catch (error) {
      setStatus(`Draft error: ${(error as Error).message}`);
    }
  };

  const handleStartEditSurvey = async (surveyId: string): Promise<void> => {
    const current = surveys.find((s) => s.id === surveyId);
    if (current?.status === 'submitted') {
      setStatus(`Survey ${surveyId} is submitted and read-only`);
      return;
    }

    try {
      const draft = await getLocalSurveyDraft(surveyId);
      if (!draft) {
        setStatus(`Survey not found locally: ${surveyId}`);
        return;
      }
      applyDraftToForm(draft);
      setEditingSurveyId(surveyId);
      setSelectedSurveyId(surveyId);
      setScreen('edit');
      setStatus(`Editing survey ${surveyId}`);
    } catch (error) {
      setStatus(`Edit load error: ${(error as Error).message}`);
    }
  };

  const handleSaveSurveyEdits = async (): Promise<void> => {
    if (!editingSurveyId) {
      setStatus('No survey selected for editing');
      return;
    }

    try {
      await updateLocalDraft({
        survey_id: editingSurveyId,
        site_name: siteName.trim() || 'Unnamed site',
        region_version: regionVersion,
        vegetation_stage: vegetationStage,
        factors: buildFactorsPayload(),
        visibility: 'private',
        location: {}
      });

      await refreshLocalSurveys();
      await refreshLocalAttachments();
      setScreen('list');
      setStatus(`Local survey ${editingSurveyId} updated and queued for sync`);
    } catch (error) {
      setStatus(`Edit save error: ${(error as Error).message}`);
    }
  };

  const handleCancelSurveyEdit = (): void => {
    setEditingSurveyId(null);
    setScreen('list');
    setStatus('Edit mode cancelled');
  };

  const handleCancelSurveyForm = (): void => {
    if (screen === 'edit') {
      handleCancelSurveyEdit();
      return;
    }
    setScreen('list');
    setStatus('Create mode cancelled');
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
      await refreshLocalAttachments();
      setStatus(
        `Sync complete: ${result.synced} synced, ${result.failed} failed, ${result.pulled_surveys} surveys pulled, ${result.pulled_attachments} attachments pulled`
      );
    } catch (error) {
      setStatus(`Sync error: ${(error as Error).message}`);
    }
  };

  const handlePullChanges = async (): Promise<void> => {
    if (!accessToken) {
      setStatus('Login required before pulling server changes');
      return;
    }

    try {
      setStatus('Pulling server changes...');
      const result = await pullRemoteChanges(apiUrl, accessToken);
      await refreshLocalSurveys();
      await refreshLocalAttachments();
      setStatus(`Pull complete: ${result.surveys} surveys, ${result.attachments} attachments, pages ${result.pages}`);
    } catch (error) {
      setStatus(`Pull error: ${(error as Error).message}`);
    }
  };

  const handleSubmitSurvey = async (surveyId: string): Promise<void> => {
    if (!accessToken) {
      setStatus('Login required before submit');
      return;
    }

    const blocked = surveys.find((s) => s.sync_blocked === 1);
    if (blocked) {
      setStatus(`Sync conflict unresolved for ${blocked.id}. Use Retry now or Discard local change first.`);
      return;
    }

    const target = surveys.find((s) => s.id === surveyId);
    if (!target) {
      setStatus(`Survey not found locally: ${surveyId}`);
      return;
    }

    if (target.status === 'submitted') {
      setStatus(`Survey ${surveyId} is already submitted`);
      return;
    }

    if (target.sync_state !== 'synced') {
      setStatus(`Survey ${surveyId} must be synced before submit`);
      return;
    }

    if (target.sync_blocked === 1) {
      setStatus(`Survey ${surveyId} has unresolved sync conflict. Retry or discard local change first.`);
      return;
    }

    const result = await submitSurvey(apiUrl, accessToken, target.id);
    await refreshLocalSurveys();
    await refreshLocalAttachments();
    if (result.ok && editingSurveyId === target.id) {
      setEditingSurveyId(null);
    }
    setStatus(result.ok ? `Submitted ${target.id}` : `Submit failed for ${target.id}: ${result.message}`);
  };

  const handleRetrySurvey = async (surveyId: string): Promise<void> => {
    try {
      const result = await retrySurveyNow(surveyId);
      await refreshLocalSurveys();
      await refreshLocalAttachments();
      setStatus(`Retry queued for ${surveyId} (${result.queued} queue item(s))`);
    } catch (error) {
      setStatus(`Retry error: ${(error as Error).message}`);
    }
  };

  const handleDiscardSurvey = async (surveyId: string): Promise<void> => {
    try {
      const result = await discardSurveyLocalChanges(surveyId);
      await refreshLocalSurveys();
      await refreshLocalAttachments();
      setStatus(`Local changes discarded for ${surveyId} (${result.removed_queue} queue item(s) removed)`);
    } catch (error) {
      setStatus(`Discard error: ${(error as Error).message}`);
    }
  };

  const confirmDeleteSurvey = (surveyId: string): void => {
    const current = surveys.find((s) => s.id === surveyId);
    if (current?.status === 'submitted') {
      setStatus(`Survey ${surveyId} is submitted and read-only`);
      return;
    }

    Alert.alert(
      'Delete survey',
      'This will remove the survey locally and queue remote deletion.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            queueDeleteSurvey(surveyId)
              .then(async (result) => {
                await refreshLocalSurveys();
                await refreshLocalAttachments();
                if (result.queued_delete && selectedSurveyId === surveyId) {
                  setSelectedSurveyId(null);
                  setSurveyDetailTab('summary');
                }
                setStatus(result.queued_delete ? `Deletion queued for ${surveyId}` : `Survey not found: ${surveyId}`);
              })
              .catch((error) => setStatus(`Delete error: ${(error as Error).message}`));
          }
        }
      ]
    );
  };

  const guessMimeType = (uri: string): string => {
    const normalized = uri.toLowerCase();
    if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
    if (normalized.endsWith('.png')) return 'image/png';
    if (normalized.endsWith('.heic')) return 'image/heic';
    if (normalized.endsWith('.webp')) return 'image/webp';
    return 'application/octet-stream';
  };

  const handleQueueAttachment = async (surveyId: string): Promise<void> => {
    const current = surveys.find((s) => s.id === surveyId);
    if (current?.status === 'submitted') {
      setStatus(`Survey ${surveyId} is submitted and read-only`);
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStatus('Media library permission is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8
      });

      if (result.canceled || !result.assets?.[0]) {
        setStatus('No image selected');
        return;
      }

      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? guessMimeType(asset.uri);
      const sizeBytes = typeof asset.fileSize === 'number' && asset.fileSize > 0 ? asset.fileSize : 500_000;

      await queueLocalAttachment({
        survey_id: surveyId,
        local_uri: asset.uri,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        captured_at: new Date().toISOString(),
        metadata: {
          file_name: asset.fileName ?? null,
          width: asset.width ?? null,
          height: asset.height ?? null
        }
      });

      await refreshLocalAttachments();
      setStatus(`Photo queued for survey ${surveyId}`);
    } catch (error) {
      setStatus(`Attachment queue error: ${(error as Error).message}`);
    }
  };

  const handleLoadCanonicalDetails = async (surveyId: string, options?: { silent?: boolean }): Promise<void> => {
    const silent = options?.silent ?? false;
    if (!accessToken) {
      if (!silent) {
        setStatus('Login required before loading canonical details');
      }
      return;
    }

    try {
      setDetailsLoadingSurveyId(surveyId);
      if (!silent) {
        setStatus(`Loading canonical details for ${surveyId}...`);
      }
      const response = await fetch(`${apiUrl}/surveys/${surveyId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (!silent) {
          setStatus(`Load detail failed: HTTP ${response.status}`);
        }
        return;
      }

      const payload = (await response.json()) as SurveyDetailResponse;
      setSurveyDetails((prev) => ({ ...prev, [surveyId]: payload }));
      if (!silent) {
        setStatus(`Canonical details loaded for ${surveyId}`);
      }
    } catch (error) {
      if (!silent) {
        setStatus(`Load detail error: ${(error as Error).message}`);
      }
    } finally {
      setDetailsLoadingSurveyId((current) => (current === surveyId ? null : current));
    }
  };

  const handleOpenSurvey = (surveyId: string): void => {
    setSelectedSurveyId(surveyId);
    setSurveyDetailTab('summary');
    setStatus(`Survey ${surveyId} opened`);
  };

  const handleCloseSurveyDetail = (): void => {
    setSelectedSurveyId(null);
    setSurveyDetailTab('summary');
    setStatus('Survey detail closed');
  };

  const handleLoadSurveyEvents = async (surveyId: string, options?: { silent?: boolean }): Promise<void> => {
    const silent = options?.silent ?? false;
    if (!accessToken) {
      if (!silent) {
        setStatus('Login required before loading survey events');
      }
      return;
    }

    try {
      setEventsLoadingSurveyId(surveyId);
      if (!silent) {
        setStatus(`Loading events for ${surveyId}...`);
      }
      const response = await fetch(`${apiUrl}/surveys/${surveyId}/events`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (!silent) {
          setStatus(`Load events failed: HTTP ${response.status}`);
        }
        return;
      }

      const payload = (await response.json()) as SurveyEventsResponse;
      setSurveyEvents((prev) => ({ ...prev, [surveyId]: payload.items ?? [] }));
      if (!silent) {
        setStatus(`Events loaded for ${surveyId}`);
      }
    } catch (error) {
      if (!silent) {
        setStatus(`Load events error: ${(error as Error).message}`);
      }
    } finally {
      setEventsLoadingSurveyId((current) => (current === surveyId ? null : current));
    }
  };

  useEffect(() => {
    if (!selectedSurveyId || !accessToken) {
      return;
    }
    if (surveyDetails[selectedSurveyId]) {
      return;
    }
    if (detailsLoadingSurveyId === selectedSurveyId) {
      return;
    }
    void handleLoadCanonicalDetails(selectedSurveyId, { silent: true });
  }, [selectedSurveyId, accessToken, surveyDetails, detailsLoadingSurveyId]);

  useEffect(() => {
    if (!selectedSurveyId || !accessToken) {
      return;
    }
    if (surveyDetailTab !== 'events') {
      return;
    }
    if (surveyEvents[selectedSurveyId]) {
      return;
    }
    if (eventsLoadingSurveyId === selectedSurveyId) {
      return;
    }
    void handleLoadSurveyEvents(selectedSurveyId, { silent: true });
  }, [selectedSurveyId, accessToken, surveyDetailTab, surveyEvents, eventsLoadingSurveyId]);

  const formatPoints = (value: number): string => `${value} point${value > 1 ? 's' : ''}`;

  const renderCanonicalFactor = (factorCode: string, factor: FactorCanonical) => (
    <View key={`canonical-${factorCode}`} style={styles.canonicalRow}>
      <Text style={styles.canonicalTitle}>Facteur {factorCode}</Text>
      <Text style={styles.canonicalMeta}>Classe retenue: {factor.selected_class}</Text>
      <Text style={styles.canonicalMeta}>Score: {formatPoints(factor.score_points)}</Text>
      <Text style={styles.canonicalMeta}>ID canonique: {factor.factor_id}</Text>
      {factor.warnings.length > 0 ? (
        <Text style={styles.canonicalMeta}>Warnings: {factor.warnings.join(' | ')}</Text>
      ) : null}
    </View>
  );

  const renderFactorSection = (
    key: FactorKey,
    fields: Array<{ label: string; value: string; onChange: (v: string) => void }>
  ) => (
    <View style={styles.helpCard} key={key}>
      <View style={styles.helpHeader}>
        <Text style={styles.label}>Factor {key}</Text>
      </View>
      <Text style={styles.helpText}>{HELP_BY_FACTOR[key]}</Text>
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

  const renderFilterChip = (label: string, active: boolean, onPress: () => void) => (
    <Pressable onPress={onPress} style={[styles.filterChip, active ? styles.filterChipActive : null]}>
      <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{label}</Text>
    </Pressable>
  );

  const renderSurveyBadges = (survey: LocalSurvey, attachmentCount: number) => {
    const isSubmitted = survey.status === 'submitted';
    return (
      <View style={styles.badgeRow}>
        <View style={[styles.badge, isSubmitted ? styles.badgeStatusSubmitted : styles.badgeStatusDraft]}>
          <Text style={styles.badgeText}>status: {survey.status}</Text>
        </View>
        <View
          style={[
            styles.badge,
            survey.sync_state === 'synced'
              ? styles.badgeSyncSynced
              : survey.sync_state === 'pending'
                ? styles.badgeSyncPending
                : styles.badgeSyncFailed
          ]}
        >
          <Text style={styles.badgeText}>sync: {survey.sync_state}</Text>
        </View>
        <View style={[styles.badge, styles.badgeNeutral]}>
          <Text style={styles.badgeText}>v{survey.sync_version}</Text>
        </View>
        <View style={[styles.badge, styles.badgeNeutral]}>
          <Text style={styles.badgeText}>photos: {attachmentCount}</Text>
        </View>
        {survey.sync_blocked === 1 ? (
          <View style={[styles.badge, styles.badgeBlocked]}>
            <Text style={styles.badgeText}>blocked</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const formatEventPayload = (payload?: Record<string, unknown> | null): string => {
    if (!payload) return '';
    const json = JSON.stringify(payload);
    if (!json) return '';
    return json.length > 120 ? `${json.slice(0, 117)}...` : json;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>IBP Step 20 - Local Survey Hub + Dedicated Forms</Text>
          <View style={styles.authCompact}>
            <View style={styles.authCompactHeader}>
              <Text style={styles.label}>Settings</Text>
              <Pressable onPress={() => setShowSettingsPanel((open) => !open)}>
                <Text style={styles.helpToggle}>{showSettingsPanel ? 'Hide settings' : 'Show settings'}</Text>
              </Pressable>
            </View>
            <Text style={styles.meta}>User: {profile}</Text>
          </View>

          {showSettingsPanel ? (
            <View style={styles.authPanel}>
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
              <View style={styles.spacer} />
              <Button title="Pull server changes (advanced)" onPress={handlePullChanges} />
              <View style={styles.spacer} />
              <Button title="Refresh local list" onPress={refreshLocalSurveys} />
              <View style={styles.spacer} />
              <Button title="Refresh local attachments" onPress={refreshLocalAttachments} />
            </View>
          ) : null}
          <Button title="Create new survey" onPress={handleOpenCreateSurvey} />
          <View style={styles.spacer} />
          <Button title="Sync now (push + pull)" onPress={handleSync} />

          <Text style={styles.status}>{status}</Text>
        </View>

        {screen === 'list' ? (
        <View style={styles.card}>
          <Text style={styles.title}>Local Surveys ({visibleSurveys.length}/{surveys.length})</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryItem}>draft: {surveyStats.draft}</Text>
            <Text style={styles.summaryItem}>submitted: {surveyStats.submitted}</Text>
            <Text style={styles.summaryItem}>pending: {surveyStats.pending}</Text>
            <Text style={styles.summaryItem}>synced: {surveyStats.synced}</Text>
            <Text style={styles.summaryItem}>failed: {surveyStats.failed}</Text>
            <Text style={styles.summaryItem}>blocked: {surveyStats.blocked}</Text>
          </View>

          <Text style={styles.label}>Search surveys</Text>
          <TextInput
            style={styles.input}
            value={surveyQuery}
            onChangeText={setSurveyQuery}
            placeholder="Search by site, id, or last error"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.filterChipsRow}>
              {renderFilterChip('All', statusFilter === 'all', () => setStatusFilter('all'))}
              {renderFilterChip('Draft', statusFilter === 'draft', () => setStatusFilter('draft'))}
              {renderFilterChip('Submitted', statusFilter === 'submitted', () => setStatusFilter('submitted'))}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Sync</Text>
            <View style={styles.filterChipsRow}>
              {renderFilterChip('All', syncFilter === 'all', () => setSyncFilter('all'))}
              {renderFilterChip('Pending', syncFilter === 'pending', () => setSyncFilter('pending'))}
              {renderFilterChip('Synced', syncFilter === 'synced', () => setSyncFilter('synced'))}
              {renderFilterChip('Failed', syncFilter === 'failed', () => setSyncFilter('failed'))}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Blocked</Text>
            <View style={styles.filterChipsRow}>
              {renderFilterChip('All', blockedFilter === 'all', () => setBlockedFilter('all'))}
              {renderFilterChip('Blocked only', blockedFilter === 'blocked', () => setBlockedFilter('blocked'))}
              {renderFilterChip('Unblocked', blockedFilter === 'unblocked', () => setBlockedFilter('unblocked'))}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Attachments</Text>
            <View style={styles.filterChipsRow}>
              {renderFilterChip('All', attachmentFilter === 'all', () => setAttachmentFilter('all'))}
              {renderFilterChip('With photo', attachmentFilter === 'with', () => setAttachmentFilter('with'))}
              {renderFilterChip('Without photo', attachmentFilter === 'without', () => setAttachmentFilter('without'))}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Sort</Text>
            <View style={styles.filterChipsRow}>
              {renderFilterChip('Updated (newest)', sortMode === 'updated_desc', () => setSortMode('updated_desc'))}
              {renderFilterChip('Updated (oldest)', sortMode === 'updated_asc', () => setSortMode('updated_asc'))}
              {renderFilterChip('Site A-Z', sortMode === 'site_asc', () => setSortMode('site_asc'))}
            </View>
          </View>

          <Pressable
            onPress={() => {
              setSurveyQuery('');
              setStatusFilter('all');
              setSyncFilter('all');
              setBlockedFilter('all');
              setAttachmentFilter('all');
              setSortMode('updated_desc');
            }}
            style={styles.filterReset}
          >
            <Text style={styles.filterResetText}>Reset filters</Text>
          </Pressable>

          {selectedSurvey ? (
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailTitle}>Survey detail: {selectedSurvey.site_name}</Text>
                <Pressable onPress={handleCloseSurveyDetail}>
                  <Text style={styles.helpToggle}>Close</Text>
                </Pressable>
              </View>
              <Text style={styles.rowMeta}>id: {selectedSurvey.id}</Text>
              <Text style={styles.rowMeta}>updated: {selectedSurvey.updated_at}</Text>
              {renderSurveyBadges(selectedSurvey, selectedSurveyAttachments.length)}

              <View style={styles.filterChipsRow}>
                {renderFilterChip('Summary', surveyDetailTab === 'summary', () => setSurveyDetailTab('summary'))}
                {renderFilterChip('Factors', surveyDetailTab === 'factors', () => setSurveyDetailTab('factors'))}
                {renderFilterChip('Photos', surveyDetailTab === 'photos', () => setSurveyDetailTab('photos'))}
                {renderFilterChip('Events', surveyDetailTab === 'events', () => setSurveyDetailTab('events'))}
              </View>

              {surveyDetailTab === 'summary' ? (
                <View style={styles.detailSection}>
                  {editingSurveyId === selectedSurvey.id ? <Text style={styles.editingTag}>currently edited in form above</Text> : null}
                  {selectedSurvey.status === 'submitted' ? <Text style={styles.rowMeta}>submitted survey: read-only</Text> : null}
                  {selectedSurvey.last_sync_error ? (
                    <Text style={styles.rowMeta}>last error: {selectedSurvey.last_sync_error}</Text>
                  ) : (
                    <Text style={styles.rowMeta}>No sync error reported.</Text>
                  )}
                  {selectedSurvey.last_sync_error_code ? (
                    <Text style={styles.rowMeta}>error code: {selectedSurvey.last_sync_error_code}</Text>
                  ) : null}
                  {selectedSurvey.last_sync_error_at ? (
                    <Text style={styles.rowMeta}>error at: {selectedSurvey.last_sync_error_at}</Text>
                  ) : null}
                </View>
              ) : null}

              {surveyDetailTab === 'factors' ? (
                <View style={styles.detailSection}>
                  <Button title="Refresh canonical details" onPress={() => void handleLoadCanonicalDetails(selectedSurvey.id)} />
                  {detailsLoadingSurveyId === selectedSurvey.id ? <Text style={styles.rowMeta}>Loading canonical details...</Text> : null}
                  {surveyDetails[selectedSurvey.id] ? (
                    <View style={styles.canonicalCard}>
                      <Text style={styles.canonicalHeader}>Scores globaux</Text>
                      <Text style={styles.canonicalHeaderLine}>
                        Peuplement/Gestion: {formatPoints(surveyDetails[selectedSurvey.id].scores.ibp_peuplement_gestion)}
                      </Text>
                      <Text style={styles.canonicalHeaderLine}>
                        Contexte: {formatPoints(surveyDetails[selectedSurvey.id].scores.ibp_contexte)}
                      </Text>
                      <Text style={styles.canonicalHeaderLine}>
                        Total IBP: {formatPoints(surveyDetails[selectedSurvey.id].scores.ibp_total)}
                      </Text>
                      {Object.entries(surveyDetails[selectedSurvey.id].factor_results)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([factorCode, factor]) => renderCanonicalFactor(factorCode, factor))}
                    </View>
                  ) : (
                    <View style={styles.detailSection}>
                      <Text style={styles.rowMeta}>Canonical factors not loaded yet.</Text>
                    </View>
                  )}
                </View>
              ) : null}

              {surveyDetailTab === 'photos' ? (
                <View style={styles.detailSection}>
                  {selectedSurveyAttachments.length > 0 ? (
                    <View style={styles.attachmentCard}>
                      <Text style={styles.attachmentHeader}>Local Attachments</Text>
                      {selectedSurveyAttachments.map((attachment) => (
                        <View key={attachment.id} style={styles.attachmentRow}>
                          {attachment.local_uri ? <Image source={{ uri: attachment.local_uri }} style={styles.attachmentPreview} /> : null}
                          <Text style={styles.attachmentText}>
                            {attachment.id} | {attachment.mime_type} | {Math.round(attachment.size_bytes / 1024)} KB
                          </Text>
                          <Text style={styles.attachmentText}>
                            state: {attachment.sync_state}
                            {attachment.remote_attachment_id ? ` | remote: ${attachment.remote_attachment_id}` : ''}
                          </Text>
                          {attachment.last_sync_error_code ? (
                            <Text style={styles.attachmentError}>code: {attachment.last_sync_error_code}</Text>
                          ) : null}
                          {attachment.last_sync_error ? <Text style={styles.attachmentError}>error: {attachment.last_sync_error}</Text> : null}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.rowMeta}>No photo queued for this survey.</Text>
                  )}
                </View>
              ) : null}

              {surveyDetailTab === 'events' ? (
                <View style={styles.detailSection}>
                  <Button title="Refresh events" onPress={() => void handleLoadSurveyEvents(selectedSurvey.id)} />
                  {eventsLoadingSurveyId === selectedSurvey.id ? <Text style={styles.rowMeta}>Loading events...</Text> : null}
                  {(surveyEvents[selectedSurvey.id] ?? []).length === 0 && eventsLoadingSurveyId !== selectedSurvey.id ? (
                    <Text style={styles.rowMeta}>No events loaded yet.</Text>
                  ) : null}
                  {(surveyEvents[selectedSurvey.id] ?? []).map((event) => (
                    <View key={event.id} style={styles.eventRow}>
                      <Text style={styles.eventTitle}>{event.event_type}</Text>
                      <Text style={styles.rowMeta}>{event.created_at}</Text>
                      {formatEventPayload(event.payload) ? (
                        <Text style={styles.eventPayload}>{formatEventPayload(event.payload)}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.detailSection}>
                {selectedSurvey.status !== 'submitted' ? (
                  <>
                    <Button title="Edit survey" onPress={() => handleStartEditSurvey(selectedSurvey.id)} />
                    <View style={styles.miniSpacer} />
                    <Button title="Attach photo (queue)" onPress={() => handleQueueAttachment(selectedSurvey.id)} />
                    <View style={styles.miniSpacer} />
                    <Button title="Delete survey" onPress={() => confirmDeleteSurvey(selectedSurvey.id)} />
                    <View style={styles.miniSpacer} />
                  </>
                ) : null}
                {selectedSurvey.sync_state === 'synced' && selectedSurvey.status !== 'submitted' && selectedSurvey.sync_blocked !== 1 ? (
                  <>
                    <Button title="Submit survey" onPress={() => handleSubmitSurvey(selectedSurvey.id)} />
                    <View style={styles.miniSpacer} />
                  </>
                ) : null}
                {selectedSurvey.sync_state === 'failed' ? (
                  <>
                    <Button title="Retry now" onPress={() => handleRetrySurvey(selectedSurvey.id)} />
                    <View style={styles.miniSpacer} />
                    <Button title="Discard local change" onPress={() => handleDiscardSurvey(selectedSurvey.id)} />
                    <View style={styles.miniSpacer} />
                  </>
                ) : null}
              </View>
            </View>
          ) : null}

          {visibleSurveys.map((survey) => {
            const attachmentCount = attachmentCountBySurvey[survey.id] ?? 0;
            return (
              <View key={survey.id} style={styles.row}>
              <Text style={styles.rowTitle}>{survey.site_name}</Text>
              <Text style={styles.rowMeta}>id: {survey.id}</Text>
              <Text style={styles.rowMeta}>updated: {survey.updated_at}</Text>
              {renderSurveyBadges(survey, attachmentCount)}
              {selectedSurveyId === survey.id ? <Text style={styles.editingTag}>selected in detail panel</Text> : null}
              <View style={styles.miniSpacer} />
              <Button title="Open survey" onPress={() => handleOpenSurvey(survey.id)} />
              </View>
            );
          })}
          {surveys.length === 0 ? <Text style={styles.meta}>No local survey yet.</Text> : null}
          {surveys.length > 0 && visibleSurveys.length === 0 ? (
            <Text style={styles.meta}>No survey matches current filters.</Text>
          ) : null}
        </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.title}>{screen === 'edit' ? 'Edit survey (dedicated view)' : 'Create survey (dedicated view)'}</Text>
            {screen === 'edit' && editingSurveyId ? <Text style={styles.meta}>Survey id: {editingSurveyId}</Text> : null}

            <Text style={styles.label}>Site name</Text>
            <TextInput style={styles.input} value={siteName} onChangeText={setSiteName} />

            <Text style={styles.label}>Region version</Text>
            <View style={styles.filterChipsRow}>
              {REGION_OPTIONS.map((option) =>
                renderFilterChip(option.label, regionVersion === option.value, () => handleRegionChange(option.value))
              )}
            </View>

            <Text style={styles.label}>Vegetation stage</Text>
            <View style={styles.filterChipsRow}>
              {VEGETATION_STAGE_OPTIONS_BY_REGION[regionVersion].map((option) =>
                renderFilterChip(option.label, vegetationStage === option.value, () => setVegetationStage(option.value))
              )}
            </View>

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

            {screen === 'edit' ? (
              <Button title="Save survey edits" onPress={handleSaveSurveyEdits} />
            ) : (
              <Button title="Create offline draft" onPress={handleCreateDraft} />
            )}
            <View style={styles.spacer} />
            <Button title="Back to survey list" onPress={handleCancelSurveyForm} />
            <Text style={styles.status}>{status}</Text>
          </View>
        )}
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
  authCompact: {
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    backgroundColor: '#f8fbff'
  },
  authCompactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  authPanel: {
    borderWidth: 1,
    borderColor: '#dce8f5',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: '#fbfdff'
  },
  detailCard: {
    borderWidth: 1,
    borderColor: '#d6e5f5',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: '#f7fbff'
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#184369'
  },
  detailSection: {
    gap: 6
  },
  eventRow: {
    borderTopWidth: 1,
    borderTopColor: '#e4edf7',
    paddingTop: 6,
    gap: 2
  },
  eventTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2a5378'
  },
  eventPayload: {
    fontSize: 11,
    color: '#4f6882'
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  summaryItem: {
    fontSize: 12,
    color: '#3f5c79',
    backgroundColor: '#eef4fb',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  filterGroup: {
    gap: 6
  },
  filterLabel: {
    fontSize: 12,
    color: '#3f5c79',
    fontWeight: '600'
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#c6d8ea',
    borderRadius: 999,
    backgroundColor: '#f7fbff',
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  filterChipActive: {
    borderColor: '#2d6fb5',
    backgroundColor: '#e8f2ff'
  },
  filterChipText: {
    fontSize: 12,
    color: '#335a80'
  },
  filterChipTextActive: {
    color: '#1d4f84',
    fontWeight: '600'
  },
  filterReset: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#edf3fa'
  },
  filterResetText: {
    fontSize: 12,
    color: '#2f5478',
    fontWeight: '600'
  },
  spacer: {
    height: 2
  },
  miniSpacer: {
    height: 4
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
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#254b6f'
  },
  badgeNeutral: {
    backgroundColor: '#edf3fa'
  },
  badgeStatusDraft: {
    backgroundColor: '#fff0cc'
  },
  badgeStatusSubmitted: {
    backgroundColor: '#dff4e8'
  },
  badgeSyncPending: {
    backgroundColor: '#f4ebff'
  },
  badgeSyncSynced: {
    backgroundColor: '#dcf3ea'
  },
  badgeSyncFailed: {
    backgroundColor: '#ffe2e2'
  },
  badgeBlocked: {
    backgroundColor: '#ffd6d6'
  },
  editingTag: {
    fontSize: 12,
    color: '#1a5ea8',
    fontWeight: '600'
  },
  attachmentCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e6eef7',
    borderRadius: 8,
    padding: 8,
    gap: 6,
    backgroundColor: '#fbfdff'
  },
  attachmentHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#25567f'
  },
  attachmentRow: {
    borderTopWidth: 1,
    borderTopColor: '#edf3fa',
    paddingTop: 6,
    gap: 2
  },
  attachmentPreview: {
    width: 88,
    height: 88,
    borderRadius: 6,
    backgroundColor: '#edf3fa'
  },
  attachmentText: {
    fontSize: 11,
    color: '#4c6985'
  },
  attachmentError: {
    fontSize: 11,
    color: '#9f3d3d'
  },
  canonicalCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d9e8f7',
    borderRadius: 8,
    padding: 8,
    gap: 6,
    backgroundColor: '#f7fbff'
  },
  canonicalHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a466f'
  },
  canonicalHeaderLine: {
    fontSize: 12,
    color: '#204f7b'
  },
  canonicalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e6eef7',
    paddingTop: 6,
    gap: 2
  },
  canonicalTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#204f7b'
  },
  canonicalMeta: {
    fontSize: 12,
    color: '#55708b'
  }
});
