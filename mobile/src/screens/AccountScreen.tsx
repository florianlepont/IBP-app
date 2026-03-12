import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { brandColors, brandRadius, brandShadow, brandSpacing, brandTypography } from '../app/brand-tokens';
import { AuthUser } from '../app/types';

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
  apiUrl: string;
  onSaveProfile: (input: UpdateProfileInput) => Promise<void>;
  onPickProfilePictureFromLibrary: () => Promise<void>;
  onTakeProfilePictureFromCamera: () => Promise<void>;
  onRemoveProfilePicture: () => Promise<void>;
  onConfirmEmailChange: (token: string) => Promise<void>;
  onLogout: () => Promise<void>;
};

type ActionButtonVariant = 'neutral' | 'primary' | 'danger';
type Tone = 'neutral' | 'success' | 'warning' | 'danger';
type PhotoMenuAnchor = { x: number; y: number; width: number; height: number };

type ActionButtonProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant?: ActionButtonVariant;
  disabled?: boolean;
  compact?: boolean;
  large?: boolean;
  onPress: () => void;
};

function ActionButton({ label, icon, variant = 'neutral', disabled = false, compact = false, large = false, onPress }: ActionButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        compact ? styles.actionButtonCompact : null,
        large ? styles.actionButtonLarge : null,
        variant === 'primary' ? styles.actionButtonPrimary : null,
        variant === 'danger' ? styles.actionButtonDanger : null,
        disabled ? styles.actionButtonDisabled : null
      ]}
    >
      <Ionicons
        name={icon}
        size={large ? 18 : 16}
        color={
          disabled
            ? brandColors.textSecondary
            : variant === 'primary'
              ? brandColors.white
              : variant === 'danger'
                ? brandColors.terracotta
                : brandColors.forest
        }
      />
      <Text
        style={[
          styles.actionButtonText,
          compact ? styles.actionButtonTextCompact : null,
          large ? styles.actionButtonTextLarge : null,
          variant === 'primary' ? styles.actionButtonTextPrimary : null,
          variant === 'danger' ? styles.actionButtonTextDanger : null,
          disabled ? styles.actionButtonTextDisabled : null
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StatusChip({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View
      style={[
        styles.statusChip,
        tone === 'success'
          ? styles.statusChipSuccess
          : tone === 'warning'
            ? styles.statusChipWarning
            : tone === 'danger'
              ? styles.statusChipDanger
              : null
      ]}
    >
      <Text style={styles.statusChipText}>{label}</Text>
    </View>
  );
}

function ProfileField({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  autoCorrect,
  keyboardType
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  keyboardType?: 'default' | 'email-address';
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={brandColors.textSecondary}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const resolveInitials = (user: AuthUser | null, fallbackProfile: string): string => {
  const source =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
    user?.display_name?.trim() ||
    user?.email?.trim() ||
    fallbackProfile.trim() ||
    'Account';

  return source
    .split(/[\s@._-]+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
};

export function AccountScreen({
  accessToken,
  currentUser,
  profile,
  profileUpdating,
  apiUrl,
  onSaveProfile,
  onPickProfilePictureFromLibrary,
  onTakeProfilePictureFromCamera,
  onRemoveProfilePicture,
  onConfirmEmailChange,
  onLogout
}: AccountScreenProps) {
  const avatarButtonRef = useRef<View | null>(null);
  const pendingPhotoActionRef = useRef<(() => void) | null>(null);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [emailConfirmToken, setEmailConfirmToken] = useState('');
  const [photoMenuVisible, setPhotoMenuVisible] = useState(false);
  const [photoMenuAnchor, setPhotoMenuAnchor] = useState<PhotoMenuAnchor | null>(null);

  useEffect(() => {
    setFirstName(currentUser?.first_name ?? '');
    setLastName(currentUser?.last_name ?? '');
    setDisplayName(currentUser?.display_name ?? '');
    setProfileEmail(currentUser?.email ?? '');
    setEmailConfirmToken(currentUser?.email_change_token_dev ?? '');
  }, [currentUser]);

  useEffect(() => {
    if (photoMenuVisible || !pendingPhotoActionRef.current) {
      return;
    }

    const nextAction = pendingPhotoActionRef.current;
    pendingPhotoActionRef.current = null;
    const timeoutId = setTimeout(() => {
      nextAction();
    }, 220);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [photoMenuVisible]);

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

  const heroName =
    displayName.trim() ||
    [firstName.trim(), lastName.trim()].filter((part) => part.length > 0).join(' ') ||
    currentUser?.display_name ||
    profile ||
    'Account';
  const heroSubtitle = currentUser?.email ?? 'No email attached yet';
  const initials = resolveInitials(currentUser, profile);
  const roleLabel = currentUser?.role?.trim() || 'member';
  const photoActions = useMemo(
    () => [
      {
        key: 'camera',
        label: 'Take photo',
        icon: 'camera-outline' as const,
        danger: false,
        action: () => {
          void onTakeProfilePictureFromCamera();
        }
      },
      {
        key: 'gallery',
        label: 'Choose from gallery',
        icon: 'image-outline' as const,
        danger: false,
        action: () => {
          void onPickProfilePictureFromLibrary();
        }
      },
      ...(profilePictureUri
        ? [
            {
              key: 'remove',
              label: 'Remove photo',
              icon: 'trash-outline' as const,
              danger: true,
              action: () => {
                void onRemoveProfilePicture();
              }
            }
          ]
        : [])
    ],
    [onPickProfilePictureFromLibrary, onRemoveProfilePicture, onTakeProfilePictureFromCamera, profilePictureUri]
  );

  const closePhotoMenu = (): void => {
    setPhotoMenuVisible(false);
  };

  const openPhotoActions = (): void => {
    avatarButtonRef.current?.measureInWindow((x, y, width, height) => {
      setPhotoMenuAnchor({ x, y, width, height });
      setPhotoMenuVisible(true);
    });
  };

  const menuWidth = Math.min(312, viewportWidth - 24);
  const estimatedMenuHeight = 92 + photoActions.length * 58;
  const preferredTop = photoMenuAnchor ? photoMenuAnchor.y + photoMenuAnchor.height + 12 : 110;
  const fallbackTop = photoMenuAnchor ? photoMenuAnchor.y - estimatedMenuHeight - 12 : 24;
  const menuTop =
    photoMenuAnchor && preferredTop + estimatedMenuHeight > viewportHeight - 24
      ? Math.max(24, fallbackTop)
      : Math.max(24, preferredTop);
  const menuLeft = photoMenuAnchor ? Math.min(Math.max(16, photoMenuAnchor.x - 6), viewportWidth - menuWidth - 16) : 16;

  return (
    <>
      <Modal transparent visible={photoMenuVisible} animationType="fade" onRequestClose={closePhotoMenu}>
        <View style={styles.photoMenuOverlay}>
          <Pressable style={styles.photoMenuDismissArea} onPress={closePhotoMenu} />
          <View style={[styles.photoMenuCard, { top: menuTop, left: menuLeft, width: menuWidth }]}>
            <BlurView intensity={68} tint="light" style={styles.photoMenuBlur}>
              <View style={styles.photoMenuPreviewRow}>
                <View style={styles.photoMenuPreviewAvatar}>
                  {profilePictureUri ? (
                    <Image
                      source={{
                        uri: profilePictureUri,
                        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
                      }}
                      style={styles.photoMenuPreviewImage}
                    />
                  ) : (
                    <Text style={styles.photoMenuPreviewFallback}>{initials || 'A'}</Text>
                  )}
                </View>
                <View style={styles.photoMenuPreviewCopy}>
                  <Text style={styles.photoMenuTitle}>Profile photo</Text>
                  <Text style={styles.photoMenuSubtitle}>
                    {profilePictureUri ? 'Update or remove the current avatar.' : 'Choose how to add a profile photo.'}
                  </Text>
                </View>
              </View>

              <View style={styles.photoMenuList}>
                {photoActions.map((item, index) => (
                  <View key={item.key}>
                    <Pressable
                      style={styles.photoMenuActionRow}
                      onPress={() => {
                        pendingPhotoActionRef.current = item.action;
                        closePhotoMenu();
                      }}
                    >
                      <View style={[styles.photoMenuActionIconWrap, item.danger ? styles.photoMenuActionIconWrapDanger : null]}>
                        <Ionicons
                          name={item.icon}
                          size={18}
                          color={item.danger ? brandColors.terracotta : brandColors.forest}
                        />
                      </View>
                      <Text style={[styles.photoMenuActionLabel, item.danger ? styles.photoMenuActionLabelDanger : null]}>{item.label}</Text>
                    </Pressable>
                    {index < photoActions.length - 1 ? <View style={styles.photoMenuSeparator} /> : null}
                  </View>
                ))}
              </View>
            </BlurView>
          </View>
        </View>
      </Modal>

      <View style={styles.screen}>
      <View style={styles.accountSummaryCard}>
        <View style={styles.identityRow}>
          <Pressable ref={avatarButtonRef} style={styles.avatarHeroButton} onPress={openPhotoActions} disabled={profileUpdating}>
            {profilePictureUri ? (
              <Image
                source={{
                  uri: profilePictureUri,
                  headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
                }}
                style={styles.avatarHeroImage}
              />
            ) : (
              <View style={styles.avatarHeroFallback}>
                <Text style={styles.avatarHeroFallbackText}>{initials || 'A'}</Text>
              </View>
            )}
          </Pressable>

          <View style={styles.identityCopy}>
            <Text style={styles.identityName}>{heroName}</Text>
            <Text style={styles.identityMeta}>{heroSubtitle}</Text>
            <View style={styles.heroChipRow}>
              <StatusChip label={roleLabel} />
              {currentUser?.email_change_required ? <StatusChip label="Email pending" tone="warning" /> : null}
            </View>
          </View>
        </View>

        <View style={styles.summaryFooterRow}>
          <ActionButton label="Logout" icon="log-out-outline" variant="danger" onPress={() => void onLogout()} compact />
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>Profile fields</Text>
            <Text style={styles.sectionBody}>Edit the synced identity shown across the app and shared survey data.</Text>
          </View>
          {isProfileDirty ? <StatusChip label="Unsaved changes" tone="warning" /> : <StatusChip label="Up to date" tone="success" />}
        </View>

        <View style={styles.twoColumnRow}>
          <View style={styles.halfField}>
            <ProfileField label="First name" value={firstName} onChangeText={setFirstName} placeholder="Florian" autoCapitalize="words" />
          </View>
          <View style={styles.halfField}>
            <ProfileField label="Last name" value={lastName} onChangeText={setLastName} placeholder="Lepont" autoCapitalize="words" />
          </View>
        </View>

        <ProfileField label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Field identity shown to others" autoCapitalize="words" />
        <ProfileField
          label="Email"
          value={profileEmail}
          onChangeText={setProfileEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <ActionButton
          label={profileUpdating ? 'Saving profile...' : 'Save profile'}
          icon={profileUpdating ? 'hourglass-outline' : 'save-outline'}
          variant="primary"
          large
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
      </View>

      {currentUser?.email_change_required ? (
        <View style={[styles.panel, styles.pendingEmailPanel]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={styles.sectionTitle}>Confirm pending email</Text>
              <Text style={styles.sectionBody}>A confirmation step is required before the new email becomes active on the account.</Text>
            </View>
            <StatusChip label="Pending" tone="warning" />
          </View>

          <View style={styles.pendingEmailNotice}>
            <Ionicons name="mail-open-outline" size={18} color={brandColors.ochre} />
            <Text style={styles.pendingEmailNoticeText}>Pending email: {currentUser.email_change_pending_to ?? 'unknown'}</Text>
          </View>

          <ProfileField
            label="Confirmation token"
            value={emailConfirmToken}
            onChangeText={setEmailConfirmToken}
            placeholder="Paste confirmation token"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <ActionButton
            label="Confirm pending email"
            icon="checkmark-circle-outline"
            variant="primary"
            onPress={() => void onConfirmEmailChange(emailConfirmToken)}
            disabled={profileUpdating || emailConfirmToken.trim().length === 0}
          />
        </View>
      ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: brandSpacing.md
  },
  photoMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(24, 28, 23, 0.12)'
  },
  photoMenuDismissArea: {
    ...StyleSheet.absoluteFillObject
  },
  photoMenuCard: {
    position: 'absolute',
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    backgroundColor: 'rgba(248, 242, 234, 0.78)',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8
  },
  photoMenuBlur: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6
  },
  photoMenuPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    paddingBottom: 6
  },
  photoMenuPreviewAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.56)'
  },
  photoMenuPreviewImage: {
    width: '100%',
    height: '100%'
  },
  photoMenuPreviewFallback: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    color: brandColors.forest
  },
  photoMenuPreviewCopy: {
    flex: 1,
    gap: 2
  },
  photoMenuTitle: {
    ...brandTypography.label,
    fontSize: 14,
    lineHeight: 16,
    color: brandColors.textPrimary
  },
  photoMenuSubtitle: {
    ...brandTypography.meta,
    color: brandColors.textSecondary
  },
  photoMenuList: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.28)'
  },
  photoMenuActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 12
  },
  photoMenuActionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.52)'
  },
  photoMenuActionIconWrapDanger: {
    backgroundColor: '#F6E1D8'
  },
  photoMenuActionLabel: {
    flex: 1,
    ...brandTypography.sectionBody,
    fontSize: 17,
    lineHeight: 22,
    color: brandColors.textPrimary
  },
  photoMenuActionLabelDanger: {
    color: brandColors.terracotta
  },
  photoMenuSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
    backgroundColor: 'rgba(62, 74, 54, 0.16)'
  },
  accountSummaryCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 14,
    gap: 10,
    ...brandShadow.card
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  avatarHeroButton: {
    width: 104,
    height: 104,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panelMuted
  },
  avatarHeroImage: {
    width: '100%',
    height: '100%'
  },
  avatarHeroFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brandColors.panelMuted
  },
  avatarHeroFallbackText: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '900',
    color: brandColors.forest
  },
  identityCopy: {
    flex: 1,
    gap: 6
  },
  identityName: {
    ...brandTypography.sectionTitle,
    fontSize: 22,
    lineHeight: 24,
    color: brandColors.forest
  },
  identityMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary
  },
  heroChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  statusChip: {
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  statusChipSuccess: {
    borderColor: '#BBD09B',
    backgroundColor: brandColors.successSoft
  },
  statusChipWarning: {
    borderColor: '#E7C281',
    backgroundColor: '#F7E6CA'
  },
  statusChipDanger: {
    borderColor: '#E4A595',
    backgroundColor: brandColors.errorSoft
  },
  statusChipText: {
    ...brandTypography.meta,
    color: brandColors.forest
  },
  summaryFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12
  },
  panel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 14,
    gap: 10,
    ...brandShadow.card
  },
  pendingEmailPanel: {
    backgroundColor: '#FBF6EC'
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4
  },
  sectionTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 20,
    lineHeight: 22,
    color: brandColors.forest
  },
  sectionBody: {
    ...brandTypography.meta,
    color: brandColors.textSecondary
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  actionButtonCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  actionButtonLarge: {
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  actionButtonPrimary: {
    borderColor: brandColors.forest,
    backgroundColor: brandColors.forest
  },
  actionButtonDanger: {
    borderColor: '#E4A595',
    backgroundColor: brandColors.errorSoft
  },
  actionButtonDisabled: {
    opacity: 0.48
  },
  actionButtonText: {
    ...brandTypography.meta,
    color: brandColors.forest
  },
  actionButtonTextCompact: {
    fontSize: 11,
    lineHeight: 14
  },
  actionButtonTextLarge: {
    ...brandTypography.button
  },
  actionButtonTextPrimary: {
    color: brandColors.white
  },
  actionButtonTextDanger: {
    color: brandColors.terracotta
  },
  actionButtonTextDisabled: {
    color: brandColors.textSecondary
  },
  twoColumnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  halfField: {
    flex: 1,
    minWidth: 140
  },
  fieldGroup: {
    gap: 6
  },
  fieldLabel: {
    ...brandTypography.label,
    color: brandColors.forest
  },
  fieldInput: {
    borderRadius: brandRadius.field,
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    backgroundColor: brandColors.inputFill,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: brandColors.textPrimary,
    ...brandTypography.input
  },
  pendingEmailNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 18,
    backgroundColor: '#F7E6CA',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  pendingEmailNoticeText: {
    flex: 1,
    ...brandTypography.sectionBody,
    color: brandColors.textPrimary
  }
});
