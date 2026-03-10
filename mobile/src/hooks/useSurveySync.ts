import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Network from 'expo-network';
import { evaluateSubmitReadinessFromDraft } from '../app/ibp-scoring';
import { getSubmitBlockReason } from '../app/survey-logic';
import {
  SurveyDetailResponse,
  SurveyDetailTab,
  SurveyEventItem
} from '../app/types';
import {
  confirmMyEmail,
  createSurveyReport,
  deleteMyProfilePicture,
  loadSurveyDetail,
  loadSurveyEvents,
  patchMyProfile,
  resetIbpData,
  resetUserData,
  uploadMyProfilePicture
} from '../api/ibp-api';
import {
  clearLocalIbpData,
  discardSurveyLocalChanges,
  getLocalSurveyDraft,
  hasPendingSyncWork,
  LocalSurvey,
  markSurveyExpiredLocally,
  pullRemoteChanges,
  queueDeleteAttachment,
  queueDeleteSurvey,
  queueLocalAttachment,
  retrySurveyNow,
  submitSurvey,
  syncPending,
  updateSurveyVisibility
} from '../storage';
import { createInitialOperationStatus, updateOperationStatus } from './operation-status';
import { AUTH_REQUIRED_ERROR, useAuthSession } from './useAuthSession';

type UseSurveySyncParams = {
  apiUrl: string;
  email: string;
  password: string;
  displayName: string;
  surveys: LocalSurvey[];
  selectedSurveyId: string | null;
  surveyDetailTab: SurveyDetailTab;
  editingSurveyId: string | null;
  refreshLocalSurveys: () => Promise<void>;
  refreshLocalAttachments: () => Promise<void>;
  onCloseSurveyDetail: () => void;
  onStopEditing: () => void;
};

type UpdateProfileInput = {
  first_name: string;
  last_name: string;
  display_name: string;
  email: string;
  profile_picture_url?: string | null;
};

const guessMimeType = (uri: string): string => {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.heic')) return 'image/heic';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
};

const isUnauthorizedResultMessage = (message: string): boolean =>
  /(^|[^0-9])401([^0-9]|$)|unauthorized|auth_required/i.test(message);

const isOnlineNetworkState = (state: Network.NetworkState): boolean =>
  Boolean(state.isConnected) && (state.isInternetReachable ?? true);

const formatSubmitReadinessError = (surveyId: string, readiness: ReturnType<typeof evaluateSubmitReadinessFromDraft>): string => {
  if (readiness.expired) {
    return `Survey ${surveyId} is expired and cannot be submitted`;
  }

  const parts: string[] = [];
  if (readiness.missing_factors.length > 0) {
    parts.push(`missing/invalid factors: ${readiness.missing_factors.join(', ')}`);
  }
  if (readiness.missing_fields.includes('region_version')) {
    parts.push('missing region version');
  }
  if (readiness.missing_fields.includes('vegetation_stage')) {
    parts.push('missing vegetation stage');
  }
  if (readiness.missing_fields.includes('location')) {
    parts.push('missing location (GPS or full manual address)');
  }

  if (parts.length === 0) {
    return `Survey ${surveyId} is not ready for submit`;
  }

  return `Submit blocked for ${surveyId}: ${parts.join(' | ')}`;
};

export function useSurveySync({
  apiUrl,
  email,
  password,
  displayName,
  surveys,
  selectedSurveyId,
  surveyDetailTab,
  editingSurveyId,
  refreshLocalSurveys,
  refreshLocalAttachments,
  onCloseSurveyDetail,
  onStopEditing
}: UseSurveySyncParams) {
  const [profileUpdating, setProfileUpdating] = useState(false);
  const [statusText, setStatusText] = useState<string>('Ready');
  const [operationStatus, setOperationStatus] = useState(createInitialOperationStatus('Ready'));
  const [surveyDetails, setSurveyDetails] = useState<Record<string, SurveyDetailResponse>>({});
  const [detailsLoadingSurveyId, setDetailsLoadingSurveyId] = useState<string | null>(null);
  const [surveyEvents, setSurveyEvents] = useState<Record<string, SurveyEventItem[]>>({});
  const [eventsLoadingSurveyId, setEventsLoadingSurveyId] = useState<string | null>(null);
  const syncInProgressRef = useRef(false);
  const lastOnlineStateRef = useRef<boolean | null>(null);
  const lastAutoSyncAtRef = useRef<number>(0);
  const detailAutoLoadCooldownUntilRef = useRef<Record<string, number>>({});

  const clearSurveySessionState = useCallback((): void => {
    setSurveyDetails({});
    setSurveyEvents({});
    detailAutoLoadCooldownUntilRef.current = {};
  }, []);

  const reportStatus = useCallback((scope: 'session' | 'auth' | 'profile' | 'sync' | 'survey' | 'attachment' | 'debug', state: 'idle' | 'running' | 'success' | 'error', message: string): void => {
    setStatusText(message);
    setOperationStatus((current) => updateOperationStatus(current, scope, state, message));
  }, []);

  const setStatus = useCallback((message: string): void => {
    reportStatus('session', 'idle', message);
  }, [reportStatus]);

  const {
    accessToken,
    refreshToken,
    sessionRestoring,
    currentUser,
    profile,
    isAuthenticated,
    setProfileFromUser,
    clearSession,
    refreshSessionTokens,
    withAuthRetry,
    handleLoadMyProfile,
    handleLogin,
    handleRegister,
    handleLogout
  } = useAuthSession({
    apiUrl,
    email,
    password,
    displayName,
    reportStatus,
    onSessionCleared: clearSurveySessionState
  });

  const handleUpdateProfile = async (input: UpdateProfileInput): Promise<void> => {
    const payload = {
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      display_name: input.display_name.trim(),
      email: input.email.trim().toLowerCase(),
      ...(Object.prototype.hasOwnProperty.call(input, 'profile_picture_url')
        ? { profile_picture_url: input.profile_picture_url ?? null }
        : {})
    };

    if (!payload.display_name) {
      setStatus('Display name is required');
      return;
    }
    if (!payload.email || !payload.email.includes('@')) {
      setStatus('A valid email is required');
      return;
    }

    try {
      setProfileUpdating(true);
      const user = await withAuthRetry((token) => patchMyProfile(apiUrl, token, payload));

      setProfileFromUser(user);
      if (user.email_change_required) {
        setStatus(`Profile updated. Email confirmation required for ${user.email_change_pending_to ?? 'pending email'}`);
      } else {
        setStatus('Profile updated');
      }
    } catch (error) {
      if ((error as Error).message === AUTH_REQUIRED_ERROR) {
        await clearSession();
        setStatus('Login required before updating profile');
        return;
      }
      setStatus(`Profile update error: ${(error as Error).message}`);
    } finally {
      setProfileUpdating(false);
    }
  };

  const handleConfirmEmailChange = async (token: string): Promise<void> => {
    if (!token.trim()) {
      setStatus('Email confirmation token is required');
      return;
    }

    try {
      setProfileUpdating(true);
      const user = await withAuthRetry((access) => confirmMyEmail(apiUrl, access, token.trim()));

      setProfileFromUser(user);
      setStatus('Email address confirmed');
    } catch (error) {
      if ((error as Error).message === AUTH_REQUIRED_ERROR) {
        await clearSession();
        setStatus('Login required before confirming email');
        return;
      }
      setStatus(`Email confirmation error: ${(error as Error).message}`);
    } finally {
      setProfileUpdating(false);
    }
  };

  const uploadProfilePictureFromAsset = async (asset: ImagePicker.ImagePickerAsset): Promise<void> => {
    const mimeType = asset.mimeType ?? guessMimeType(asset.uri);
    const payload = new FormData();
    payload.append('file', {
      uri: asset.uri,
      type: mimeType,
      name: asset.fileName ?? `profile-${Date.now()}`
    } as any);

    try {
      setProfileUpdating(true);
      setStatus('Uploading profile picture...');
      const uploadResponse = await withAuthRetry(async (token) => {
        const body = await uploadMyProfilePicture(apiUrl, token, payload);
        if (!body.profile_picture_url) {
          throw new Error(body.message ?? 'Profile picture URL missing after upload');
        }
        return body.profile_picture_url;
      });

      const baseUser = currentUser ?? (await handleLoadMyProfile({ silent: true }));
      if (!baseUser) {
        setStatus('Profile picture uploaded, but profile refresh requires login');
        return;
      }

      await handleUpdateProfile({
        first_name: baseUser.first_name,
        last_name: baseUser.last_name,
        display_name: baseUser.display_name,
        email: baseUser.email,
        profile_picture_url: uploadResponse
      });
      setStatus('Profile picture uploaded');
    } catch (error) {
      if ((error as Error).message === AUTH_REQUIRED_ERROR) {
        await clearSession();
        setStatus('Login required before uploading profile picture');
        return;
      }
      setStatus(`Profile picture upload error: ${(error as Error).message}`);
    } finally {
      setProfileUpdating(false);
    }
  };

  const handlePickProfilePictureFromLibrary = async (): Promise<void> => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStatus('Media library permission is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8
      });
      if (result.canceled || !result.assets?.[0]) {
        setStatus('No image selected');
        return;
      }

      await uploadProfilePictureFromAsset(result.assets[0]);
    } catch (error) {
      setStatus(`Profile image picker error: ${(error as Error).message}`);
    }
  };

  const handleTakeProfilePictureFromCamera = async (): Promise<void> => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setStatus('Camera permission is required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8
      });
      if (result.canceled || !result.assets?.[0]) {
        setStatus('No photo captured');
        return;
      }

      await uploadProfilePictureFromAsset(result.assets[0]);
    } catch (error) {
      setStatus(`Profile camera error: ${(error as Error).message}`);
    }
  };

  const handleRemoveProfilePicture = async (): Promise<void> => {
    const baseUser = currentUser ?? (await handleLoadMyProfile({ silent: true }));
    if (!baseUser) {
      setStatus('Login required before removing profile picture');
      return;
    }

    try {
      setProfileUpdating(true);
      await withAuthRetry((token) => deleteMyProfilePicture(apiUrl, token));
      await handleUpdateProfile({
        first_name: baseUser.first_name,
        last_name: baseUser.last_name,
        display_name: baseUser.display_name,
        email: baseUser.email,
        profile_picture_url: null
      });
      setStatus('Profile picture removed');
    } catch (error) {
      if ((error as Error).message === AUTH_REQUIRED_ERROR) {
        await clearSession();
        setStatus('Login required before removing profile picture');
        return;
      }
      setStatus(`Profile picture remove error: ${(error as Error).message}`);
    } finally {
      setProfileUpdating(false);
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
    if (lastOnlineStateRef.current === true) {
      void maybeAutoSync('attachment-queued');
    }
  };


  const runSync = useCallback(async (mode: 'manual' | 'auto', trigger?: string): Promise<void> => {
    if (syncInProgressRef.current) {
      if (mode === 'manual') {
        setStatus('Sync already in progress...');
      }
      return;
    }

    syncInProgressRef.current = true;
    try {
      if (mode === 'manual') {
        setStatus('Sync in progress...');
      } else {
        setStatus(`Back online. Sync in progress${trigger ? ` (${trigger})` : ''}...`);
      }
      const result = await withAuthRetry((token) => syncPending(apiUrl, token));
      await refreshLocalSurveys();
      await refreshLocalAttachments();
      setStatus(
        `Sync complete: ${result.synced} synced, ${result.failed} failed, ${result.pulled_surveys} surveys pulled, ${result.pulled_attachments} attachments pulled`
      );
    } catch (error) {
      if ((error as Error).message === AUTH_REQUIRED_ERROR) {
        await clearSession();
        setStatus(mode === 'manual' ? 'Login required before sync' : 'Sync paused: login required');
        return;
      }
      setStatus(`Sync error: ${(error as Error).message}`);
    } finally {
      syncInProgressRef.current = false;
    }
  }, [apiUrl, clearSession, refreshLocalAttachments, refreshLocalSurveys, withAuthRetry]);

  const handleSync = async (): Promise<void> => {
    await runSync('manual');
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

  const handleReportSurvey = async (surveyId: string, reason: string): Promise<{ ok: boolean; message: string }> => {
    const surveyIdTrimmed = surveyId.trim();
    const reasonTrimmed = reason.trim();
    if (!surveyIdTrimmed) {
      const message = 'Survey id is required before reporting';
      setStatus(message);
      return { ok: false, message };
    }
    if (!reasonTrimmed) {
      const message = 'Report reason is required';
      setStatus(message);
      return { ok: false, message };
    }

    try {
      await withAuthRetry((token) => createSurveyReport(apiUrl, token, { survey_id: surveyIdTrimmed, reason: reasonTrimmed }));
      const message = 'Report sent to moderation';
      setStatus(message);
      return { ok: true, message };
    } catch (error) {
      if ((error as Error).message === AUTH_REQUIRED_ERROR) {
        await clearSession();
        const message = 'Login required before reporting a survey';
        setStatus(message);
        return { ok: false, message };
      }
      const message = `Report error: ${(error as Error).message}`;
      setStatus(message);
      return { ok: false, message };
    }
  };

  const maybeAutoSync = useCallback(
    async (trigger: string): Promise<void> => {
      if (!(accessToken || refreshToken)) {
        return;
      }

      const cooldownMs = 15_000;
      const now = Date.now();
      if (now - lastAutoSyncAtRef.current < cooldownMs) {
        return;
      }

      const hasWork = await hasPendingSyncWork();
      if (!hasWork) {
        return;
      }

      lastAutoSyncAtRef.current = now;
      await runSync('auto', trigger);
    },
    [accessToken, refreshToken, runSync]
  );

  const handleDebugResetIbpData = async (): Promise<void> => {
    Alert.alert('Debug reset IBP data', 'This will delete all IBP surveys/events/attachments on server and clear local IBP data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              setStatus('Debug reset IBP data in progress...');
              const result = await withAuthRetry((token) => resetIbpData(apiUrl, token));

              await clearLocalIbpData();
              await refreshLocalSurveys();
              await refreshLocalAttachments();
              setSurveyDetails({});
              setSurveyEvents({});
              onCloseSurveyDetail();
              if (editingSurveyId) {
                onStopEditing();
              }
              setStatus(
                `IBP data reset done: ${result.surveys_deleted ?? 0} surveys, ${result.attachments_deleted ?? 0} attachments, ${result.events_deleted ?? 0} events`
              );
            } catch (error) {
              if ((error as Error).message === AUTH_REQUIRED_ERROR) {
                await clearSession();
                setStatus('Login required before debug reset');
                return;
              }
              setStatus(`Debug reset IBP error: ${(error as Error).message}`);
            }
          })();
        }
      }
    ]);
  };

  const handleDebugResetUserData = async (): Promise<void> => {
    Alert.alert('Debug reset user data', 'This will delete all users on server and clear your local session and IBP data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              setStatus('Debug reset user data in progress...');
              const result = await withAuthRetry((token) => resetUserData(apiUrl, token));

              await clearLocalIbpData();
              onCloseSurveyDetail();
              if (editingSurveyId) {
                onStopEditing();
              }
              await clearSession();
              await refreshLocalSurveys();
              await refreshLocalAttachments();
              setStatus(
                `User data reset done: ${result.users_deleted ?? 0} users, ${result.surveys_deleted ?? 0} surveys, ${result.attachments_deleted ?? 0} attachments`
              );
            } catch (error) {
              if ((error as Error).message === AUTH_REQUIRED_ERROR) {
                await clearSession();
                setStatus('Login required before debug reset');
                return;
              }
              setStatus(`Debug reset user error: ${(error as Error).message}`);
            }
          })();
        }
      }
    ]);
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
      const draft = await getLocalSurveyDraft(surveyId);
      if (!draft) {
        setStatus(`Survey not found locally: ${surveyId}`);
        return;
      }

      const readiness = evaluateSubmitReadinessFromDraft({
        region_version: draft.region_version,
        vegetation_stage: draft.vegetation_stage,
        factors: draft.factors,
        location: draft.location,
        expires_at: draft.expires_at
      });

      if (!readiness.ready) {
        if (readiness.expired) {
          await markSurveyExpiredLocally(surveyId);
          await refreshLocalSurveys();
        }
        setStatus(formatSubmitReadinessError(surveyId, readiness));
        return;
      }
    } catch (error) {
      setStatus(`Submit check error for ${surveyId}: ${(error as Error).message}`);
      return;
    }

    try {
      const result = await withAuthRetry(async (token) => {
        const submitResult = await submitSurvey(apiUrl, token, surveyId);
        if (!submitResult.ok && isUnauthorizedResultMessage(submitResult.message)) {
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
      setStatus(result.ok ? `Submitted ${surveyId}` : `Submit blocked for ${surveyId}: ${result.message}`);
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
      if (!result.ok && isUnauthorizedResultMessage(result.message)) {
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
              if (result.queued_delete && lastOnlineStateRef.current === true) {
                void maybeAutoSync('survey-delete-queued');
              }
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

  const handleDeleteAttachment = async (surveyId: string, localAttachmentId: string): Promise<void> => {
    const current = surveys.find((survey) => survey.id === surveyId);
    if (current?.status === 'submitted') {
      setStatus(`Survey ${surveyId} is submitted and read-only`);
      return;
    }

    try {
      const result = await queueDeleteAttachment(surveyId, localAttachmentId);
      if (!result.removed_local) {
        setStatus(`Attachment not found locally: ${localAttachmentId}`);
        return;
      }

      if (result.queued_delete) {
        try {
          const syncResult = await withAuthRetry((token) => syncPending(apiUrl, token));
          await refreshLocalSurveys();
          await refreshLocalAttachments();
          setStatus(
            `Attachment removed and synced: ${syncResult.synced} synced, ${syncResult.failed} failed, ${syncResult.pulled_surveys} surveys pulled, ${syncResult.pulled_attachments} attachments pulled`
          );
          return;
        } catch (error) {
          if ((error as Error).message === AUTH_REQUIRED_ERROR) {
            await refreshLocalSurveys();
            await refreshLocalAttachments();
            setStatus('Attachment removed locally. Login and sync to propagate server deletion.');
            return;
          }
          await refreshLocalSurveys();
          await refreshLocalAttachments();
          setStatus(`Attachment removed locally; delete queued (sync pending: ${(error as Error).message})`);
          return;
        }
      }

      await refreshLocalSurveys();
      await refreshLocalAttachments();
      setStatus('Attachment removed locally');
    } catch (error) {
      setStatus(`Attachment delete error: ${(error as Error).message}`);
    }
  };

  const handleLoadCanonicalDetails = async (surveyId: string, options?: { silent?: boolean }): Promise<void> => {
    const silent = options?.silent ?? false;

    try {
      setDetailsLoadingSurveyId(surveyId);
      if (!silent) {
        setStatus(`Loading canonical details for ${surveyId}...`);
      }
      const payload = await withAuthRetry((token) => loadSurveyDetail(apiUrl, token, surveyId));

      setSurveyDetails((previous) => ({ ...previous, [surveyId]: payload }));
      if (detailAutoLoadCooldownUntilRef.current[surveyId]) {
        delete detailAutoLoadCooldownUntilRef.current[surveyId];
      }
      if (!silent) {
        setStatus(`Canonical details loaded for ${surveyId}`);
      }
    } catch (error) {
      // Prevent endless request loops on non-fetchable surveys (local-only or server errors).
      detailAutoLoadCooldownUntilRef.current[surveyId] = Date.now() + 60_000;
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
      const payload = await withAuthRetry((token) => loadSurveyEvents(apiUrl, token, surveyId));

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

  useEffect(() => {
    let mounted = true;

    const handleNetworkState = (state: Network.NetworkState): void => {
      const online = isOnlineNetworkState(state);
      const wasOnline = lastOnlineStateRef.current;
      lastOnlineStateRef.current = online;

      if (online && wasOnline === false) {
        void maybeAutoSync('reconnected');
      }
    };

    void Network.getNetworkStateAsync()
      .then((state) => {
        if (!mounted) return;
        handleNetworkState(state);
        if (isOnlineNetworkState(state)) {
          void maybeAutoSync('startup');
        }
      })
      .catch(() => undefined);

    const subscription = Network.addNetworkStateListener((state) => {
      if (!mounted) return;
      handleNetworkState(state);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [maybeAutoSync]);

  useEffect(() => {
    if (!(accessToken || refreshToken)) {
      return;
    }
    if (lastOnlineStateRef.current === true) {
      void maybeAutoSync('auth-ready');
    }
  }, [accessToken, refreshToken, maybeAutoSync]);

  useEffect(() => {
    if (!(accessToken || refreshToken)) {
      return;
    }

    const intervalId = setInterval(() => {
      if (lastOnlineStateRef.current === true) {
        void maybeAutoSync('heartbeat');
      }
    }, 30_000);

    return () => {
      clearInterval(intervalId);
    };
  }, [accessToken, refreshToken, maybeAutoSync]);

  useEffect(() => {
    if (!(accessToken || refreshToken)) {
      return;
    }
    if (lastOnlineStateRef.current !== true) {
      return;
    }
    void maybeAutoSync('local-queue-updated');
  }, [surveys, accessToken, refreshToken, maybeAutoSync]);

  useEffect(() => {
    if (!selectedSurveyId || !accessToken) {
      return;
    }
    const selectedSurvey = surveys.find((survey) => survey.id === selectedSurveyId);
    if (!selectedSurvey) {
      return;
    }
    if (selectedSurvey.status !== 'submitted' && selectedSurvey.status !== 'expired' && selectedSurvey.sync_state !== 'synced') {
      return;
    }
    if (surveyDetails[selectedSurveyId]) {
      return;
    }
    if (detailsLoadingSurveyId === selectedSurveyId) {
      return;
    }
    const cooldownUntil = detailAutoLoadCooldownUntilRef.current[selectedSurveyId] ?? 0;
    if (cooldownUntil > Date.now()) {
      return;
    }
    void handleLoadCanonicalDetails(selectedSurveyId, { silent: true });
  }, [selectedSurveyId, accessToken, surveys, surveyDetails, detailsLoadingSurveyId]);

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
    sessionRestoring,
    isAuthenticated,
    currentUser,
    profile,
    profileUpdating,
    status: statusText,
    operationStatus,
    setStatus,
    surveyDetails,
    detailsLoadingSurveyId,
    surveyEvents,
    eventsLoadingSurveyId,
    handleLogin,
    handleRegister,
    handleLogout,
    handleLoadMyProfile,
    handleUpdateProfile,
    handleConfirmEmailChange,
    handlePickProfilePictureFromLibrary,
    handleTakeProfilePictureFromCamera,
    handleRemoveProfilePicture,
    handleSync,
    handlePullChanges,
    handleReportSurvey,
    handleDebugResetIbpData,
    handleDebugResetUserData,
    handleSubmitSurvey,
    handleRetrySurvey,
    handleDiscardSurvey,
    handleToggleVisibility,
    confirmDeleteSurvey,
    handleQueueAttachmentFromLibrary,
    handleQueueAttachmentFromCamera,
    handleDeleteAttachment,
    handleLoadCanonicalDetails,
    handleLoadSurveyEvents
  };
}
