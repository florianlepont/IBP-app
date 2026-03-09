import { useEffect, useMemo, useState } from 'react';
import { Button, Image, Text, TextInput, View } from 'react-native';
import { AuthUser } from '../app/types';
import { styles } from '../app/styles';

type UpdateProfileInput = {
  first_name: string;
  last_name: string;
  display_name: string;
  email: string;
};

type ProfileScreenProps = {
  accessToken: string;
  isAuthenticated: boolean;
  currentUser: AuthUser | null;
  profile: string;
  profileUpdating: boolean;
  status: string;
  apiUrl: string;
  onApiUrlChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  onLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
  onSync: () => Promise<void>;
  onPullChanges: () => Promise<void>;
  onDebugResetIbpData: () => Promise<void>;
  onDebugResetUserData: () => Promise<void>;
  onRefreshLocalList: () => Promise<void>;
  onRefreshLocalAttachments: () => Promise<void>;
  onReloadProfile: () => Promise<AuthUser | null>;
  onSaveProfile: (input: UpdateProfileInput) => Promise<void>;
  onPickProfilePictureFromLibrary: () => Promise<void>;
  onTakeProfilePictureFromCamera: () => Promise<void>;
  onRemoveProfilePicture: () => Promise<void>;
  onConfirmEmailChange: (token: string) => Promise<void>;
};

export function ProfileScreen({
  accessToken,
  isAuthenticated,
  currentUser,
  profile,
  profileUpdating,
  status,
  apiUrl,
  onApiUrlChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  onLogin,
  onLogout,
  onSync,
  onPullChanges,
  onDebugResetIbpData,
  onDebugResetUserData,
  onRefreshLocalList,
  onRefreshLocalAttachments,
  onReloadProfile,
  onSaveProfile,
  onPickProfilePictureFromLibrary,
  onTakeProfilePictureFromCamera,
  onRemoveProfilePicture,
  onConfirmEmailChange
}: ProfileScreenProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [emailConfirmToken, setEmailConfirmToken] = useState('');

  useEffect(() => {
    setFirstName(currentUser?.first_name ?? '');
    setLastName(currentUser?.last_name ?? '');
    setDisplayName(currentUser?.display_name ?? '');
    setProfileEmail(currentUser?.email ?? '');
    setEmailConfirmToken(currentUser?.email_change_token_dev ?? '');
  }, [currentUser]);

  const profilePictureUri = useMemo(() => {
    const raw = currentUser?.profile_picture_url;
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    const trimmedBase = apiUrl.replace(/\/+$/, '');
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    return `${trimmedBase}${path}`;
  }, [apiUrl, currentUser?.profile_picture_url]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.meta}>User: {profile}</Text>

      {isAuthenticated ? (
        <>
          <View style={styles.avatarCard}>
            <Text style={styles.label}>Profile picture</Text>
            {profilePictureUri ? (
              <Image
                source={{
                  uri: profilePictureUri,
                  headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
                }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.meta}>No profile picture</Text>
              </View>
            )}
            <Button title="Take photo" onPress={() => void onTakeProfilePictureFromCamera()} disabled={profileUpdating} />
            <View style={styles.spacer} />
            <Button title="Choose from gallery" onPress={() => void onPickProfilePictureFromLibrary()} disabled={profileUpdating} />
            <View style={styles.spacer} />
            <Button title="Remove photo" onPress={() => void onRemoveProfilePicture()} disabled={profileUpdating} />
          </View>

          <Text style={styles.label}>First name</Text>
          <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />

          <Text style={styles.label}>Last name</Text>
          <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />

          <Text style={styles.label}>Display name</Text>
          <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={profileEmail}
            onChangeText={setProfileEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          {currentUser?.email_change_required ? (
            <View style={styles.infoCard}>
              <Text style={styles.meta}>Pending email: {currentUser.email_change_pending_to ?? 'unknown'}</Text>
              <Text style={styles.meta}>Enter the token received by email to confirm the change.</Text>
              <Text style={styles.label}>Confirmation token</Text>
              <TextInput
                style={styles.input}
                value={emailConfirmToken}
                onChangeText={setEmailConfirmToken}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Paste confirmation token"
              />
              <Button title="Confirm pending email" onPress={() => void onConfirmEmailChange(emailConfirmToken)} disabled={profileUpdating} />
            </View>
          ) : null}

          <Button
            title={profileUpdating ? 'Saving profile...' : 'Save profile'}
            onPress={() =>
              void onSaveProfile({
                first_name: firstName,
                last_name: lastName,
                display_name: displayName,
                email: profileEmail
              })
            }
            disabled={profileUpdating}
          />
          <View style={styles.spacer} />
          <Button title="Reload profile" onPress={() => void onReloadProfile()} disabled={profileUpdating} />
          <View style={styles.spacer} />
          <Button title="Logout" onPress={() => void onLogout()} />
          <View style={styles.spacer} />
        </>
      ) : (
        <>
          <Text style={styles.meta}>Not logged in.</Text>
          <View style={styles.spacer} />
        </>
      )}

      <View style={styles.authPanel}>
        <Text style={styles.subtitle}>Settings</Text>
        <Text style={styles.label}>API URL</Text>
        <TextInput style={styles.input} value={apiUrl} onChangeText={onApiUrlChange} autoCapitalize="none" autoCorrect={false} />

        <Text style={styles.label}>Login email</Text>
        <TextInput style={styles.input} value={email} onChangeText={onEmailChange} autoCapitalize="none" autoCorrect={false} />

        <Text style={styles.label}>Login password</Text>
        <TextInput style={styles.input} value={password} onChangeText={onPasswordChange} secureTextEntry />

        <Button title="Login with credentials" onPress={() => void onLogin()} />
        <View style={styles.spacer} />
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
      </View>

      <Text style={styles.status}>{status}</Text>
    </View>
  );
}
