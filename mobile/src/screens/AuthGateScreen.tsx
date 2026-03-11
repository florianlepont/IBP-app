import { useState } from 'react';
import {
  Image,
  ImageBackground,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from 'react-native';

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
  heroBackgroundSource?: ImageSourcePropType;
  heroForegroundLeftSource?: ImageSourcePropType;
  heroForegroundRightSource?: ImageSourcePropType;
};

type AuthMode = 'login' | 'register';
const AUTH_REQUEST_TIMEOUT_MS = 15000;

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
  heroBackgroundSource,
  heroForegroundLeftSource,
  heroForegroundRightSource,
  status
}: AuthGateScreenProps) {
  const { height } = useWindowDimensions();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isRegister = authMode === 'register';
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
    setAuthMode(nextMode);
    setLocalError('');
    if (nextMode === 'login') {
      setConfirmPassword('');
    }
  };

  const heroHeight = Math.round(height * 0.3);

  return (
    <View style={authStyles.screen}>
      <View style={[authStyles.hero, { height: heroHeight }]}>
        {heroBackgroundSource ? (
          <ImageBackground source={heroBackgroundSource} style={authStyles.heroBackground} resizeMode="cover">
            <View style={authStyles.heroOverlay} />
            {heroForegroundLeftSource ? (
              <Image source={heroForegroundLeftSource} style={authStyles.heroLeftDecoration} resizeMode="contain" />
            ) : null}
            {heroForegroundRightSource ? (
              <Image source={heroForegroundRightSource} style={authStyles.heroRightDecoration} resizeMode="contain" />
            ) : null}

            <View style={authStyles.brandCard}>
              {logoSource ? <Image source={logoSource} style={authStyles.logo} resizeMode="contain" /> : null}
              <View style={authStyles.brandTextCol}>
                <Text style={authStyles.brandTitle}>IBP</Text>
                <Text style={authStyles.brandSubtitle}>Etats Sauvages</Text>
              </View>
            </View>
          </ImageBackground>
        ) : (
          <View style={[authStyles.heroBackground, authStyles.heroPlainBackground]}>
            {heroForegroundLeftSource ? (
              <Image source={heroForegroundLeftSource} style={authStyles.heroLeftDecoration} resizeMode="contain" />
            ) : null}
            {heroForegroundRightSource ? (
              <Image source={heroForegroundRightSource} style={authStyles.heroRightDecoration} resizeMode="contain" />
            ) : null}

            <View style={authStyles.brandCard}>
              {logoSource ? <Image source={logoSource} style={authStyles.logo} resizeMode="contain" /> : null}
              <View style={authStyles.brandTextCol}>
                <Text style={authStyles.brandTitle}>IBP</Text>
                <Text style={authStyles.brandSubtitle}>Etats Sauvages</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={authStyles.panelWrap}>
        <ScrollView
          style={authStyles.panelScroll}
          contentContainerStyle={authStyles.panelContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={authStyles.modeRow}>
            <Pressable
              style={[authStyles.modeButton, !isRegister ? authStyles.modeButtonActive : null]}
              onPress={() => switchMode('login')}
              testID="auth-mode-login"
            >
              <Text style={[authStyles.modeButtonText, !isRegister ? authStyles.modeButtonTextActive : null]}>Sign in</Text>
            </Pressable>
            <Pressable
              style={[authStyles.modeButton, isRegister ? authStyles.modeButtonActive : null]}
              onPress={() => switchMode('register')}
              testID="auth-mode-register"
            >
              <Text style={[authStyles.modeButtonText, isRegister ? authStyles.modeButtonTextActive : null]}>Sign up</Text>
            </Pressable>
          </View>

          {isRegister ? (
            <>
              <Text style={authStyles.label}>Display name</Text>
              <TextInput
                style={authStyles.input}
                value={displayName}
                onChangeText={onDisplayNameChange}
                autoCorrect={false}
                placeholder="Display name"
              />
            </>
          ) : null}

          <Text style={authStyles.label}>Email address</Text>
          <TextInput
            style={authStyles.input}
            value={email}
            onChangeText={onEmailChange}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
          />

          <Text style={authStyles.label}>Password</Text>
          <TextInput
            style={authStyles.input}
            value={password}
            onChangeText={onPasswordChange}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Password"
          />

          {isRegister ? (
            <>
              <Text style={authStyles.label}>Confirm password</Text>
              <TextInput
                style={authStyles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Confirm your password"
                testID="auth-confirm-password"
              />
            </>
          ) : null}

          <Pressable
            style={[authStyles.primaryButton, submitting ? authStyles.primaryButtonDisabled : null]}
            onPress={() => void handleSubmit()}
            disabled={submitting}
            testID="auth-submit"
          >
            <Text style={authStyles.primaryButtonText}>
              {submitting ? 'Processing...' : isRegister ? 'Create account' : 'Sign in'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setShowAdvanced((current) => !current)}
            style={authStyles.advancedToggle}
            testID="auth-advanced-toggle"
          >
            <Text style={authStyles.advancedToggleText}>
              {showAdvanced ? 'Hide API options' : 'Show API options'}
            </Text>
          </Pressable>

          {showAdvanced ? (
            <View style={authStyles.advancedPanel}>
              <Text style={authStyles.label}>API URL</Text>
              <TextInput
                style={authStyles.input}
                value={apiUrl}
                onChangeText={onApiUrlChange}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://192.168.x.x:3000/v1"
              />
              <Text style={authStyles.hint}>
                iOS Simulator: localhost. Physical phone: your Mac local IP (same Wi-Fi).
              </Text>
            </View>
          ) : null}

          {localError ? <Text style={authStyles.errorText}>{localError}</Text> : null}
          {shouldShowStatus ? <Text style={authStyles.statusText}>{status}</Text> : null}
        </ScrollView>
      </View>
    </View>
  );
}

const authStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#e8ece7'
  },
  hero: {
    width: '100%'
  },
  heroBackground: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
    paddingBottom: 42,
    overflow: 'hidden'
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(13, 70, 46, 0.78)'
  },
  heroPlainBackground: {
    backgroundColor: '#155736'
  },
  heroLeftDecoration: {
    position: 'absolute',
    left: -16,
    bottom: -12,
    width: 166,
    height: 184,
    opacity: 0.75
  },
  heroRightDecoration: {
    position: 'absolute',
    right: -18,
    bottom: -8,
    width: 152,
    height: 188,
    opacity: 0.88
  },
  brandCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 1,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(240, 255, 244, 0.36)',
    backgroundColor: 'rgba(10, 43, 29, 0.42)'
  },
  logo: {
    width: 54,
    height: 54,
    borderRadius: 12
  },
  brandTextCol: {
    gap: 0
  },
  brandTitle: {
    fontSize: 42,
    lineHeight: 42,
    color: '#f2fbf4',
    fontWeight: '900'
  },
  brandSubtitle: {
    marginTop: 2,
    fontSize: 16,
    color: '#d7efdc',
    fontWeight: '700'
  },
  panelWrap: {
    flex: 1,
    marginTop: -24,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: '#f5f7f4',
    borderTopWidth: 1,
    borderColor: '#d7e0d8'
  },
  panelScroll: {
    flex: 1
  },
  panelContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 10
  },
  modeRow: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c9d8ca',
    padding: 3,
    backgroundColor: '#e7eee7',
    marginBottom: 6
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center'
  },
  modeButtonActive: {
    backgroundColor: '#1f6e4b'
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3e6050'
  },
  modeButtonTextActive: {
    color: '#ecfff2'
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#204f39'
  },
  input: {
    borderWidth: 1,
    borderColor: '#c7d8cb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#eff4ef',
    fontSize: 15
  },
  primaryButton: {
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: '#2e8559',
    paddingVertical: 12,
    alignItems: 'center'
  },
  primaryButtonDisabled: {
    opacity: 0.7
  },
  primaryButtonText: {
    color: '#f1fff4',
    fontSize: 17,
    fontWeight: '800'
  },
  advancedToggle: {
    alignSelf: 'center',
    paddingVertical: 2
  },
  advancedToggleText: {
    fontSize: 13,
    color: '#4a785f',
    fontWeight: '700'
  },
  advancedPanel: {
    borderWidth: 1,
    borderColor: '#d2ddd4',
    borderRadius: 14,
    backgroundColor: '#edf2ed',
    padding: 12,
    gap: 6
  },
  hint: {
    fontSize: 12,
    color: '#4d6959'
  },
  errorText: {
    marginTop: 6,
    color: '#8d2f2f',
    fontSize: 13,
    fontWeight: '600'
  },
  statusText: {
    marginTop: 4,
    color: '#2a533f',
    fontSize: 13
  }
});
