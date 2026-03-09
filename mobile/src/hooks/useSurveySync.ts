import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getSubmitBlockReason } from '../app/survey-logic';
import {
  LoginResponse,
  SurveyDetailResponse,
  SurveyDetailTab,
  SurveyEventItem,
  SurveyEventsResponse
} from '../app/types';
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
  const [profile, setProfile] = useState<string>('Not logged in');
  const [status, setStatus] = useState<string>('Ready');
  const [surveyDetails, setSurveyDetails] = useState<Record<string, SurveyDetailResponse>>({});
  const [detailsLoadingSurveyId, setDetailsLoadingSurveyId] = useState<string | null>(null);
  const [surveyEvents, setSurveyEvents] = useState<Record<string, SurveyEventItem[]>>({});
  const [eventsLoadingSurveyId, setEventsLoadingSurveyId] = useState<string | null>(null);

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

    const result = await submitSurvey(apiUrl, accessToken, surveyId);
    await refreshLocalSurveys();
    await refreshLocalAttachments();
    if (result.ok && editingSurveyId === surveyId) {
      onStopEditing();
    }
    setStatus(result.ok ? `Submitted ${surveyId}` : `Submit failed for ${surveyId}: ${result.message}`);
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
    if (!accessToken) {
      setStatus('Login required before changing visibility');
      return;
    }

    try {
      const result = await updateSurveyVisibility(apiUrl, accessToken, surveyId, visibility);
      await refreshLocalSurveys();
      if (!result.ok) {
        setStatus(`Visibility update failed for ${surveyId}: ${result.message}`);
        return;
      }
      setStatus(`Visibility set to ${result.visibility ?? visibility} for ${surveyId}`);
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
      setSurveyDetails((previous) => ({ ...previous, [surveyId]: payload }));
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
      setSurveyEvents((previous) => ({ ...previous, [surveyId]: payload.items ?? [] }));
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

  return {
    accessToken,
    profile,
    status,
    setStatus,
    surveyDetails,
    detailsLoadingSurveyId,
    surveyEvents,
    eventsLoadingSurveyId,
    handleLogin,
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
