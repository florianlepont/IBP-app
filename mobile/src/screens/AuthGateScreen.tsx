import { useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brandColors, brandRadius, brandShadow, brandSpacing, brandTypography } from '../app/brand-tokens';

type AuthGateScreenProps = {
  apiUrl: string;
  onApiUrlChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  onLogin: () => Promise<void>;
  onRegister: () => Promise<void>;
  status: string;
  logoSource?: ImageSourcePropType;
  heroMartenSource?: ImageSourcePropType;
};

type AuthMode = 'login' | 'register';
const AUTH_REQUEST_TIMEOUT_MS = 15000;
const HERO_MIN_HEIGHT_RATIO = 0.35;
const HERO_MIN_HEIGHT_PX = 280;

const AUTH_COPY: Record<AuthMode, { title: string; subtitle: string; submitLabel: string }> = {
  login: {
    title: 'Sign in',
    subtitle: 'Access your surveys, public map, and account settings.',
    submitLabel: 'Sign in'
  },
  register: {
    title: 'Create account',
    subtitle: 'Create your profile to save drafts, sync observations, and keep your IBP work across devices.',
    submitLabel: 'Create account'
  }
};

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number, apiUrl: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Server not responding (${apiUrl}). Check API URL and network connection.`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

type AuthFieldProps = {
  label: string;
  testID?: string;
} & TextInputProps;

function AuthField({ label, testID, ...inputProps }: AuthFieldProps) {
  return (
    <>
      <Text style={authStyles.label}>{label}</Text>
      <TextInput
        style={authStyles.input}
        placeholderTextColor={brandColors.textSecondary}
        testID={testID}
        {...inputProps}
      />
    </>
  );
}

type HeroSectionProps = {
  height: number;
  topInset: number;
  logoSource?: ImageSourcePropType;
  heroMartenSource?: ImageSourcePropType;
};

function HeroSection({ height, topInset, logoSource, heroMartenSource }: HeroSectionProps) {
  return (
    <View style={[authStyles.hero, { height }]}>
      <View style={[authStyles.heroBackground, { paddingTop: Math.max(topInset, 12) + 18 }]}>
        {heroMartenSource ? <Image source={heroMartenSource} style={authStyles.heroMarten} resizeMode="contain" /> : null}
        <View style={authStyles.heroContent}>
          {logoSource ? <Image source={logoSource} style={authStyles.heroLogo} resizeMode="contain" /> : null}
          <Text style={authStyles.heroTitle}>Welcome to the IBP app</Text>
          <Text style={authStyles.heroBody}>Sign in or create an account to sync and manage your field surveys.</Text>
        </View>
      </View>
    </View>
  );
}

type AuthModeSwitchProps = {
  authMode: AuthMode;
  onSwitchMode: (nextMode: AuthMode) => void;
};

function AuthModeSwitch({ authMode, onSwitchMode }: AuthModeSwitchProps) {
  const isRegister = authMode === 'register';

  return (
    <View style={authStyles.modeRow}>
      <Pressable
        style={[authStyles.modeButton, !isRegister ? authStyles.modeButtonActive : null]}
        onPress={() => onSwitchMode('login')}
        testID="auth-mode-login"
      >
        <Text style={[authStyles.modeButtonText, !isRegister ? authStyles.modeButtonTextActive : null]}>Sign in</Text>
      </Pressable>
      <Pressable
        style={[authStyles.modeButton, isRegister ? authStyles.modeButtonActive : null]}
        onPress={() => onSwitchMode('register')}
        testID="auth-mode-register"
      >
        <Text style={[authStyles.modeButtonText, isRegister ? authStyles.modeButtonTextActive : null]}>Create account</Text>
      </Pressable>
    </View>
  );
}

type AuthFormCardProps = {
  authMode: AuthMode;
  activeCopy: (typeof AUTH_COPY)[AuthMode];
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  submitting: boolean;
  onSubmit: () => void;
};

function AuthFormCard({
  authMode,
  activeCopy,
  displayName,
  onDisplayNameChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  submitting,
  onSubmit
}: AuthFormCardProps) {
  const isRegister = authMode === 'register';

  return (
    <View style={authStyles.formCard}>
      {isRegister ? (
        <AuthField
          label="Display name"
          value={displayName}
          onChangeText={onDisplayNameChange}
          autoCorrect={false}
          placeholder="Your public name"
        />
      ) : null}

      <AuthField
        label="Email address"
        value={email}
        onChangeText={onEmailChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="you@example.com"
      />

      <AuthField
        label="Password"
        value={password}
        onChangeText={onPasswordChange}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Password"
      />

      {isRegister ? (
        <AuthField
          label="Confirm password"
          value={confirmPassword}
          onChangeText={onConfirmPasswordChange}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Confirm your password"
          testID="auth-confirm-password"
        />
      ) : null}

      <Pressable
        style={[authStyles.primaryButton, submitting ? authStyles.primaryButtonDisabled : null]}
        onPress={onSubmit}
        disabled={submitting}
        testID="auth-submit"
      >
        <Text style={authStyles.primaryButtonText}>{submitting ? 'Processing...' : activeCopy.submitLabel}</Text>
      </Pressable>
    </View>
  );
}

type AuthPanelFooterProps = {
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  apiUrl: string;
  onApiUrlChange: (value: string) => void;
  localError: string;
  shouldShowStatus: boolean;
  status: string;
};

function AuthPanelFooter({
  showAdvanced,
  onToggleAdvanced,
  apiUrl,
  onApiUrlChange,
  localError,
  shouldShowStatus,
  status
}: AuthPanelFooterProps) {
  return (
    <View style={authStyles.panelFooter}>
      <Pressable onPress={onToggleAdvanced} style={authStyles.advancedToggle} testID="auth-advanced-toggle">
        <Text style={authStyles.advancedToggleText}>{showAdvanced ? 'Hide API options' : 'Show API options'}</Text>
      </Pressable>

      {showAdvanced ? (
        <View style={authStyles.advancedPanel}>
          <AuthField
            label="API URL"
            value={apiUrl}
            onChangeText={onApiUrlChange}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="http://192.168.x.x:3000/v1"
          />
          <Text style={authStyles.hint}>
            iOS Simulator: localhost. Physical phone: your Mac local IP on the same Wi-Fi.
          </Text>
        </View>
      ) : null}

      {localError ? <Text style={authStyles.errorText}>{localError}</Text> : null}
      {shouldShowStatus ? <Text style={authStyles.statusText}>{status}</Text> : null}
    </View>
  );
}

export function AuthGateScreen({
  apiUrl,
  onApiUrlChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  displayName,
  onDisplayNameChange,
  onLogin,
  onRegister,
  logoSource,
  heroMartenSource,
  status
}: AuthGateScreenProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isRegister = authMode === 'register';
  const activeCopy = AUTH_COPY[authMode];
  const shouldShowStatus = status.trim().toLowerCase().includes('restoring session');

  const validate = (): string | null => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return 'Enter a valid email address.';
    }
    if (!password || !password.trim()) {
      return 'Enter your password.';
    }
    if (!isRegister) {
      return null;
    }
    if (!displayName.trim()) {
      return 'Enter a display name.';
    }
    if (password.length < 6) {
      return 'Password must contain at least 6 characters.';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match.';
    }
    return null;
  };

  const handleSubmit = async (): Promise<void> => {
    const validationError = validate();
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    try {
      setLocalError('');
      setSubmitting(true);
      await runWithTimeout(isRegister ? onRegister() : onLogin(), AUTH_REQUEST_TIMEOUT_MS, apiUrl);
    } catch (error) {
      setLocalError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (nextMode: AuthMode): void => {
    if (nextMode === authMode) {
      return;
    }
    setAuthMode(nextMode);
    setLocalError('');
    if (nextMode === 'login') {
      setConfirmPassword('');
    }
  };

  const heroHeight = Math.max(Math.round(height * HERO_MIN_HEIGHT_RATIO), HERO_MIN_HEIGHT_PX);
  const useScrollablePanel = isRegister;

  const panelBody = (
    <>
      <View style={authStyles.panelMain}>
        <AuthModeSwitch authMode={authMode} onSwitchMode={switchMode} />

        <View style={authStyles.panelHeader}>
          <Text style={authStyles.panelTitle}>{activeCopy.title}</Text>
          <Text style={authStyles.panelSubtitle}>{activeCopy.subtitle}</Text>
        </View>

        <AuthFormCard
          authMode={authMode}
          activeCopy={activeCopy}
          displayName={displayName}
          onDisplayNameChange={onDisplayNameChange}
          email={email}
          onEmailChange={onEmailChange}
          password={password}
          onPasswordChange={onPasswordChange}
          confirmPassword={confirmPassword}
          onConfirmPasswordChange={setConfirmPassword}
          submitting={submitting}
          onSubmit={() => void handleSubmit()}
        />
      </View>

      <AuthPanelFooter
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((current) => !current)}
        apiUrl={apiUrl}
        onApiUrlChange={onApiUrlChange}
        localError={localError}
        shouldShowStatus={shouldShowStatus}
        status={status}
      />
    </>
  );

  return (
    <View style={authStyles.screen}>
      <HeroSection height={heroHeight} topInset={insets.top} logoSource={logoSource} heroMartenSource={heroMartenSource} />

      <View style={authStyles.panelWrap}>
        {useScrollablePanel ? (
          <ScrollView
            style={authStyles.panelScroll}
            contentContainerStyle={[authStyles.panelContent, authStyles.panelContentScrollable]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {panelBody}
          </ScrollView>
        ) : (
          <View style={[authStyles.panelContent, authStyles.panelContentFixed]}>{panelBody}</View>
        )}
      </View>
    </View>
  );
}

const authStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: brandColors.canvas
  },
  hero: {
    width: '100%'
  },
  heroBackground: {
    flex: 1,
    backgroundColor: brandColors.forest,
    overflow: 'hidden',
    paddingHorizontal: brandSpacing.lg,
    paddingBottom: 30,
    justifyContent: 'flex-end'
  },
  heroContent: {
    zIndex: 1,
    width: '62%',
    alignItems: 'flex-start',
    gap: 8
  },
  heroLogo: {
    width: 154,
    height: 50,
    alignSelf: 'flex-start',
    marginLeft: -22,
    marginBottom: 6
  },
  heroTitle: {
    ...brandTypography.heroTitle,
    color: brandColors.white
  },
  heroBody: {
    ...brandTypography.sectionBody,
    color: '#E8ECD9',
    maxWidth: 260
  },
  heroMarten: {
    position: 'absolute',
    right: 12,
    bottom: -14,
    width: 168,
    height: 216,
    zIndex: 0
  },
  panelWrap: {
    flex: 1,
    marginTop: -24,
    position: 'relative',
    overflow: 'visible',
    borderTopLeftRadius: brandRadius.panel,
    borderTopRightRadius: brandRadius.panel,
    backgroundColor: brandColors.panel,
    zIndex: 2
  },
  panelScroll: {
    flex: 1
  },
  panelContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20
  },
  panelContentScrollable: {
    gap: 18
  },
  panelContentFixed: {
    flex: 1,
    justifyContent: 'space-between'
  },
  panelMain: {
    gap: 14
  },
  panelFooter: {
    gap: 10,
    paddingTop: 10
  },
  panelHeader: {
    minHeight: 88,
    paddingTop: 6,
    paddingRight: 0,
    justifyContent: 'center',
    gap: 4
  },
  panelTitle: {
    ...brandTypography.sectionTitle,
    color: brandColors.textPrimary
  },
  panelSubtitle: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary
  },
  modeRow: {
    flexDirection: 'row',
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.divider,
    padding: 4,
    backgroundColor: '#ECE9DE'
  },
  modeButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: brandRadius.pill,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modeButtonActive: {
    backgroundColor: brandColors.textPrimary
  },
  modeButtonText: {
    ...brandTypography.label,
    color: brandColors.textSecondary,
    textAlign: 'center'
  },
  modeButtonTextActive: {
    color: brandColors.white
  },
  formCard: {
    borderRadius: brandRadius.card,
    backgroundColor: brandColors.white,
    borderWidth: 1,
    borderColor: brandColors.panelMuted,
    padding: 14,
    gap: 8,
    ...brandShadow.card
  },
  label: {
    ...brandTypography.label,
    color: brandColors.textPrimary,
    marginTop: 2
  },
  input: {
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    borderRadius: brandRadius.field,
    paddingHorizontal: 16,
    minHeight: 48,
    paddingVertical: 10,
    backgroundColor: brandColors.inputFill,
    color: brandColors.textPrimary,
    ...brandTypography.input,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500'
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.textPrimary,
    minHeight: 46,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonDisabled: {
    opacity: 0.7
  },
  primaryButtonText: {
    ...brandTypography.button,
    color: brandColors.white,
    textAlign: 'center'
  },
  advancedToggle: {
    alignSelf: 'center',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  advancedToggleText: {
    ...brandTypography.meta,
    color: brandColors.forest
  },
  advancedPanel: {
    borderWidth: 1,
    borderColor: brandColors.panelMuted,
    borderRadius: brandRadius.card,
    backgroundColor: '#F0EEE4',
    padding: 14,
    gap: 6
  },
  hint: {
    ...brandTypography.meta,
    color: brandColors.textSecondary
  },
  errorText: {
    borderRadius: 16,
    backgroundColor: brandColors.errorSoft,
    color: '#6B2E1C',
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...brandTypography.sectionBody
  },
  statusText: {
    borderRadius: 16,
    backgroundColor: brandColors.successSoft,
    color: brandColors.forest,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...brandTypography.sectionBody
  }
});
