import { useEffect, useMemo, useState } from 'react';
import { Button, Image, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthUser } from '../app/types';
import { styles } from '../app/styles';

type UpdateProfileInput = {
  first_name: string;
  last_name: string;
  display_name: string;
  email: string;
};

type AccountScreenProps = {
  accessToken: string;
  currentUser: AuthUser | null;
  profile: string;
  profileUpdating: boolean;
  status: string;
  apiUrl: string;
  onOpenSettings: () => void;
  onSaveProfile: (input: UpdateProfileInput) => Promise<void>;
  onPickProfilePictureFromLibrary: () => Promise<void>;
  onTakeProfilePictureFromCamera: () => Promise<void>;
  onRemoveProfilePicture: () => Promise<void>;
  onConfirmEmailChange: (token: string) => Promise<void>;
  onLogout: () => Promise<void>;
};

export function AccountScreen({
  accessToken,
  currentUser,
  profile,
  profileUpdating,
  status,
  apiUrl,
  onOpenSettings,
  onSaveProfile,
  onPickProfilePictureFromLibrary,
  onTakeProfilePictureFromCamera,
  onRemoveProfilePicture,
  onConfirmEmailChange,
  onLogout
}: AccountScreenProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [emailConfirmToken, setEmailConfirmToken] = useState('');
  const [profilePhotoActionsOpen, setProfilePhotoActionsOpen] = useState(false);

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

  const isProfileDirty = useMemo(() => {
    const baseFirstName = (currentUser?.first_name ?? '').trim();
    const baseLastName = (currentUser?.last_name ?? '').trim();
    const baseDisplayName = (currentUser?.display_name ?? '').trim();
    const baseEmail = (currentUser?.email ?? '').trim().toLowerCase();

    return (
      firstName.trim() !== baseFirstName ||
      lastName.trim() !== baseLastName ||
      displayName.trim() !== baseDisplayName ||
      profileEmail.trim().toLowerCase() !== baseEmail
    );
  }, [currentUser, firstName, lastName, displayName, profileEmail]);

  return (
    <View style={styles.card}>
      <View style={styles.accountHeaderRow}>
        <Text style={styles.meta}>User: {profile}</Text>
        <Pressable onPress={onOpenSettings}>
          <Ionicons name="settings-outline" size={22} color="#1a5ea8" />
        </Pressable>
      </View>

      <View style={styles.avatarCard}>
        <Text style={styles.label}>Profile picture</Text>
        <Pressable onPress={() => setProfilePhotoActionsOpen((value) => !value)} style={styles.avatarPressable}>
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
          <Text style={styles.avatarActionHint}>
            {profilePhotoActionsOpen ? 'Photo actions open' : 'Tap profile picture to manage (take / choose / remove)'}
          </Text>
        </Pressable>
        {profilePhotoActionsOpen ? (
          <>
            <Button title="Take photo" onPress={() => void onTakeProfilePictureFromCamera()} disabled={profileUpdating} />
            <View style={styles.spacer} />
            <Button title="Choose from gallery" onPress={() => void onPickProfilePictureFromLibrary()} disabled={profileUpdating} />
            <View style={styles.spacer} />
            <Button
              title="Remove photo"
              onPress={() => void onRemoveProfilePicture()}
              disabled={profileUpdating || !profilePictureUri}
            />
          </>
        ) : null}
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
        disabled={profileUpdating || !isProfileDirty}
      />
      <View style={styles.spacer} />
      <Button title="Logout" onPress={() => void onLogout()} />

      <Text style={styles.status}>{status}</Text>
    </View>
  );
}
