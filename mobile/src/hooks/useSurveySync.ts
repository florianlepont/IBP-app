import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getSubmitBlockReason } from '../app/survey-logic';
import {
  AuthUser,
  LoginResponse,
  RefreshResponse,
  SurveyDetailResponse,
  SurveyDetailTab,
  SurveyEventItem,
  SurveyEventsResponse
} from '../app/types';
import {
  clearStoredAuthSession,
  loadStoredAuthSession,
  saveStoredAuthSession
} from '../auth/session-storage';
import {
  discardSurveyLocalChanges,
  LocalSurvey,
  pullRemoteChanges,
  queueDeleteSurvey,
  queueLocalAttachment,
  retrySurveyNow,
  submitSurvey,
  syncPending,
  updateSurveyVisibility
} from '../storage';

type UseSurveySyncParams = {
  apiUrl: string;
  email: string;
  password: string;
  surveys: LocalSurvey[];
  selectedSurveyId: string | null;
  surveyDetailTab: SurveyDetailTab;
  editingSurveyId: string | null;
  refreshLocalSurveys: () => Promise<void>;
  refreshLocalAttachments: () => Promise<void>;
  onCloseSurveyDetail: () => void;
  onStopEditing: () => void;
};

const guessMimeType = (uri: string): string => {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.heic')) return 'image/heic';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
};

const AUTH_REQUIRED_ERROR = 'AUTH_REQUIRED';

const isUnauthorizedMessage = (message: string): boolean =>
  /(^|[^0-9])401([^0-9]|$)|unauthorized|auth_required/i.test(message);

export function useSurveySync({
  apiUrl,
  email,
  password,
  surveys,
  selectedSurveyId,
  surveyDetailTab,
  editingSurveyId,
  refreshLocalSurveys,
  refreshLocalAttachments,
  onCloseSurveyDetail,
  onStopEditing
}: UseSurveySyncParams) {
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [profile, setProfile] = useState<string>('Not logged in');
  const [status, setStatus] = useState<string>('Ready');
  const [surveyDetails, setSurveyDetails] = useState<Record<string, SurveyDetailResponse>>({});
  const [detailsLoadingSurveyId, setDetailsLoadingSurveyId] = useState<string | null>(null);
  const [surveyEvents, setSurveyEvents] = useState<Record<string, SurveyEventItem[]>>({});
  const [eventsLoadingSurveyId, setEventsLoadingSurveyId] = useState<string | null>(null);

  const setProfileFromUser = (user: AuthUser): void => {
    setProfile(`${user.display_name} (${user.email})`);
  };

  const clearSession = async (): Promise<void> => {
    setAccessToken('');
    setRefreshToken('');
    setProfile('Not logged in');
    setSurveyDetails({});
    setSurveyEvents({});
    await clearStoredAuthSession();
  };

  const fetchCurrentUser = async (token: string): Promise<AuthUser | null> => {
    const response = await fetch(`${apiUrl}/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AuthUser;
  };

  const refreshSessionTokens = async (tokenOverride?: string): Promise<{ accessToken: string; refreshToken: string } | null> => {
    const activeRefreshToken = tokenOverride ?? refreshToken;
    if (!activeRefreshToken || !activeRefreshToken.trim()) {
      return null;
    }

    const response = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: activeRefreshToken })
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as RefreshResponse;
    if (!payload.access_token || !payload.refresh_token) {
      return null;
    }

    setAccessToken(payload.access_token);
    setRefreshToken(payload.refresh_token);
    await saveStoredAuthSession({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token
    });

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token
    };
  };

  const ensureAccessToken = async (): Promise<string | null> => {
    if (accessToken) {
      return accessToken;
    }

    const refreshed = await refreshSessionTokens();
    return refreshed?.accessToken ?? null;
  };

  const withAuthRetry = async <T>(operation: (token: string) => Promise<T>): Promise<T> => {
    const token = await ensureAccessToken();
    if (!token) {
      throw new Error(AUTH_REQUIRED_ERROR);
    }

    try {
      return await operation(token);
    } catch (error) {
      const message = (error as Error).message ?? '';
      if (!isUnauthorizedMessage(message)) {
        throw error;
      }

      const refreshed = await refreshSessionTokens();
      if (!refreshed?.accessToken) {
        throw new Error(AUTH_REQUIRED_ERROR);
      }
      return operation(refreshed.accessToken);
    }
  };

  const queueAttachmentAsset = async (
    surveyId: string,
    asset: ImagePicker.ImagePickerAsset,
    source: 'camera' | 'library'
  ): Promise<void> => {
    const mimeType = asset.mimeType ?? guessMimeType(asset.uri);
    const sizeBytes = typeof asset.fileSize === 'number' && asset.fileSize > 0 ? asset.fileSize : 500_000;

    await queueLocalAttachment({
      survey_id: surveyId,
      local_uri: asset.uri,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      captured_at: new Date().toISOString(),
      metadata: {
        source,
        file_name: asset.fileName ?? null,
        width: asset.width ?? null,
        height: asset.height ?? null
      }
    });

    await refreshLocalAttachments();
    setStatus(`${source === 'camera' ? 'Camera photo' : 'Photo'} queued for survey ${surveyId}`);
  };

  useEffect(() => {
    let active = true;

    const restoreSession = async (): Promise<void> => {
      try {
        const stored = await loadStoredAuthSession();
        if (!stored) {
          if (active) {
            setStatus('Ready');
          }
          return;
        }

        if (active) {
          setStatus('Restoring session...');
          setAccessToken(stored.accessToken);
          setRefreshToken(stored.refreshToken);
        }

        let nextAccessToken = stored.accessToken;
        let nextRefreshToken = stored.refreshToken;
        let user = nextAccessToken ? await fetchCurrentUser(nextAccessToken) : null;

        if (!user) {
          const refreshed = await refreshSessionTokens(stored.refreshToken);
          if (refreshed) {
            nextAccessToken = refreshed.accessToken;
            nextRefreshToken = refreshed.refreshToken;
            user = await fetchCurrentUser(nextAccessToken);
          }
        }

        if (!active) {
          return;
        }

        if (!user) {
          await clearSession();
          setStatus('Session expired. Please login');
          return;
        }

        setAccessToken(nextAccessToken);
        setRefreshToken(nextRefreshToken);
        setProfileFromUser(user);
        await saveStoredAuthSession({
          accessToken: nextAccessToken,
          refreshToken: nextRefreshToken
        });
        setStatus('Session restored');
      } catch (error) {
        if (!active) {
          return;
        }
        await clearSession().catch(() => undefined);
        setStatus(`Session restore error: ${(error as Error).message}`);
      }
    };

    void restoreSession();

    return () => {
      active = false;
    };
  }, [apiUrl]);

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
      setRefreshToken(payload.refresh_token);
      setProfileFromUser(payload.user);
      await saveStoredAuthSession({
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token
      });
      setStatus('Logged in');
    } catch (error) {
      setStatus(`Login error: ${(error as Error).message}`);
    }
  };

  const handleSync = async (): Promise<void> => {
    try {
      setStatus('Sync in progress...');
      const result = await withAuthRetry((token) => syncPending(apiUrl, token));
      await refreshLocalSurveys();
      await refreshLocalAttachments();
      setStatus(
        `Sync complete: ${result.synced} synced, ${result.failed} failed, ${result.pulled_surveys} surveys pulled, ${result.pulled_attachments} attachments pulled`
      );
    } catch (error) {
      if ((error as Error).message === AUTH_REQUIRED_ERROR) {
        await clearSession();
        setStatus('Login required before sync');
        return;
      }
      setStatus(`Sync error: ${(error as Error).message}`);
    }
  };

  const handlePullChanges = async (): Promise<void> => {
    try {
      setStatus('Pulling server changes...');
      const result = await withAuthRetry((token) => pullRemoteChanges(apiUrl, token));
      await refreshLocalSurveys();
      await refreshLocalAttachments();
      setStatus(`Pull complete: ${result.surveys} surveys, ${result.attachments} attachments, pages ${result.pages}`);
    } catch (error) {
      if ((error as Error).message === AUTH_REQUIRED_ERROR) {
        await clearSession();
        setStatus('Login required before pulling server changes');
        return;
      }
      setStatus(`Pull error: ${(error as Error).message}`);
    }
  };

  const handleSubmitSurvey = async (surveyId: string): Promise<void> => {
    const blockReason = getSubmitBlockReason(surveyId, surveys);
    if (blockReason === 'not_found') {
      setStatus(`Survey not found locally: ${surveyId}`);
      return;
    }
    if (blockReason === 'global_blocked') {
      const blocked = surveys.find((survey) => survey.sync_blocked === 1);
      setStatus(`Sync conflict unresolved for ${blocked?.id ?? surveyId}. Use Retry now or Discard local change first.`);
      return;
    }
    if (blockReason === 'already_submitted') {
      setStatus(`Survey ${surveyId} is already submitted`);
      return;
    }
    if (blockReason === 'not_synced') {
      setStatus(`Survey ${surveyId} must be synced before submit`);
      return;
    }
    if (blockReason === 'survey_blocked') {
      setStatus(`Survey ${surveyId} has unresolved sync conflict. Retry or discard local change first.`);
      return;
    }

    try {
      const result = await withAuthRetry(async (token) => {
        const submitResult = await submitSurvey(apiUrl, token, surveyId);
        if (!submitResult.ok && isUnauthorizedMessage(submitResult.message)) {
          throw new Error(submitResult.message);
        }
        return submitResult;
      });

      await refreshLocalSurveys();
      await refreshLocalAttachments();
      if (result.ok) {
        void handleLoadCanonicalDetails(surveyId, { silent: true });
      }
      if (result.ok && editingSurveyId === surveyId) {
        onStopEditing();
      }
      setStatus(result.ok ? `Submitted ${surveyId}` : `Submit failed for ${surveyId}: ${result.message}`);
    } catch (error) {
      if ((error as Error).message === AUTH_REQUIRED_ERROR) {
        await clearSession();
        setStatus('Login required before submit');
        return;
      }
      setStatus(`Submit error for ${surveyId}: ${(error as Error).message}`);
    }
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

  const handleToggleVisibility = async (surveyId: string, visibility: 'private' | 'public'): Promise<void> => {
    try {
      let result = await updateSurveyVisibility(apiUrl, accessToken, surveyId, visibility);
      if (!result.ok && isUnauthorizedMessage(result.message)) {
        const refreshed = await refreshSessionTokens();
        if (!refreshed?.accessToken) {
          await clearSession();
          setStatus('Login required before changing visibility');
          return;
        }
        result = await updateSurveyVisibility(apiUrl, refreshed.accessToken, surveyId, visibility);
      }
      await refreshLocalSurveys();
      await refreshLocalAttachments();
      if (result.synced && (accessToken || refreshToken)) {
        void handleLoadCanonicalDetails(surveyId, { silent: true });
      }
      setStatus(result.ok ? result.message : `Visibility update warning for ${surveyId}: ${result.message}`);
    } catch (error) {
      setStatus(`Visibility update error: ${(error as Error).message}`);
    }
  };

  const confirmDeleteSurvey = (surveyId: string): void => {
    const current = surveys.find((survey) => survey.id === surveyId);
    if (current?.status === 'submitted') {
      setStatus(`Survey ${surveyId} is submitted and read-only`);
      return;
    }

    Alert.alert('Delete survey', 'This will remove the survey locally and queue remote deletion.', [
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
                onCloseSurveyDetail();
              }
              setStatus(result.queued_delete ? `Deletion queued for ${surveyId}` : `Survey not found: ${surveyId}`);
            })
            .catch((error) => setStatus(`Delete error: ${(error as Error).message}`));
        }
      }
    ]);
  };

  const handleQueueAttachmentFromLibrary = async (surveyId: string): Promise<void> => {
    const current = surveys.find((survey) => survey.id === surveyId);
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

      await queueAttachmentAsset(surveyId, result.assets[0], 'library');
    } catch (error) {
      setStatus(`Attachment queue error: ${(error as Error).message}`);
    }
  };

  const handleQueueAttachmentFromCamera = async (surveyId: string): Promise<void> => {
    const current = surveys.find((survey) => survey.id === surveyId);
    if (current?.status === 'submitted') {
      setStatus(`Survey ${surveyId} is submitted and read-only`);
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setStatus('Camera permission is required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8
      });

      if (result.canceled || !result.assets?.[0]) {
        setStatus('No photo captured');
        return;
      }

      await queueAttachmentAsset(surveyId, result.assets[0], 'camera');
    } catch (error) {
      setStatus(`Attachment queue error: ${(error as Error).message}`);
    }
  };

  const handleLoadCanonicalDetails = async (surveyId: string, options?: { silent?: boolean }): Promise<void> => {
    const silent = options?.silent ?? false;

    try {
      setDetailsLoadingSurveyId(surveyId);
      if (!silent) {
        setStatus(`Loading canonical details for ${surveyId}...`);
      }
      const payload = await withAuthRetry(async (token) => {
        const response = await fetch(`${apiUrl}/surveys/${surveyId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 401) {
          throw new Error('HTTP 401');
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return (await response.json()) as SurveyDetailResponse;
      });

      setSurveyDetails((previous) => ({ ...previous, [surveyId]: payload }));
      if (!silent) {
        setStatus(`Canonical details loaded for ${surveyId}`);
      }
    } catch (error) {
      if ((error as Error).message === AUTH_REQUIRED_ERROR) {
        await clearSession();
        if (!silent) {
          setStatus('Login required before loading canonical details');
        }
        return;
      }
      if (!silent) {
        setStatus(`Load detail error: ${(error as Error).message}`);
      }
    } finally {
      setDetailsLoadingSurveyId((current) => (current === surveyId ? null : current));
    }
  };

  const handleLoadSurveyEvents = async (surveyId: string, options?: { silent?: boolean }): Promise<void> => {
    const silent = options?.silent ?? false;

    try {
      setEventsLoadingSurveyId(surveyId);
      if (!silent) {
        setStatus(`Loading events for ${surveyId}...`);
      }
      const payload = await withAuthRetry(async (token) => {
        const response = await fetch(`${apiUrl}/surveys/${surveyId}/events`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 401) {
          throw new Error('HTTP 401');
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return (await response.json()) as SurveyEventsResponse;
      });

      setSurveyEvents((previous) => ({ ...previous, [surveyId]: payload.items ?? [] }));
      if (!silent) {
        setStatus(`Events loaded for ${surveyId}`);
      }
    } catch (error) {
      if ((error as Error).message === AUTH_REQUIRED_ERROR) {
        await clearSession();
        if (!silent) {
          setStatus('Login required before loading survey events');
        }
        return;
      }
      if (!silent) {
        setStatus(`Load events error: ${(error as Error).message}`);
      }
    } finally {
      setEventsLoadingSurveyId((current) => (current === surveyId ? null : current));
    }
  };

  const handleLogout = async (): Promise<void> => {
    try {
      const token = await ensureAccessToken();
      if (token) {
        await fetch(`${apiUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }).catch(() => undefined);
      }
    } finally {
      await clearSession();
      setStatus('Logged out');
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

  return {
    accessToken,
    isAuthenticated: Boolean(accessToken || refreshToken),
    profile,
    status,
    setStatus,
    surveyDetails,
    detailsLoadingSurveyId,
    surveyEvents,
    eventsLoadingSurveyId,
    handleLogin,
    handleLogout,
    handleSync,
    handlePullChanges,
    handleSubmitSurvey,
    handleRetrySurvey,
    handleDiscardSurvey,
    handleToggleVisibility,
    confirmDeleteSurvey,
    handleQueueAttachmentFromLibrary,
    handleQueueAttachmentFromCamera,
    handleLoadCanonicalDetails,
    handleLoadSurveyEvents
  };
}
