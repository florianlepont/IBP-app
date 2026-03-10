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
  heroBirdSource?: ImageSourcePropType;
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
          reject(new Error(`Le serveur ne repond pas (${apiUrl}). Verifie l'URL API et la connexion reseau.`));
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
  heroBirdSource,
  status
}: AuthGateScreenProps) {
  const { height } = useWindowDimensions();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isRegister = authMode === 'register';

  const validate = (): string | null => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return 'Saisis une adresse e-mail valide.';
    }
    if (!password || !password.trim()) {
      return 'Saisis ton mot de passe.';
    }
    if (!isRegister) {
      return null;
    }
    if (!displayName.trim()) {
      return "Saisis un nom d'utilisateur.";
    }
    if (password.length < 6) {
      return 'Le mot de passe doit contenir au moins 6 caracteres.';
    }
    if (password !== confirmPassword) {
      return 'Les mots de passe ne correspondent pas.';
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
        <ImageBackground source={heroBackgroundSource} style={authStyles.heroBackground} resizeMode="cover">
          <View style={authStyles.heroOverlay} />
          {heroForegroundLeftSource ? (
            <Image source={heroForegroundLeftSource} style={authStyles.heroLeftDecoration} resizeMode="contain" />
          ) : null}
          {heroForegroundRightSource ? (
            <Image source={heroForegroundRightSource} style={authStyles.heroRightDecoration} resizeMode="contain" />
          ) : null}
          {heroBirdSource ? (
            <Image source={heroBirdSource} style={authStyles.heroBirdDecoration} resizeMode="contain" />
          ) : null}

          <View style={authStyles.brandRow}>
            {logoSource ? <Image source={logoSource} style={authStyles.logo} resizeMode="contain" /> : null}
            <View style={authStyles.brandTextCol}>
              <Text style={authStyles.brandTitle}>IBP</Text>
              <Text style={authStyles.brandSubtitle}>Etats-sauvages</Text>
            </View>
          </View>
        </ImageBackground>
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
              <Text style={[authStyles.modeButtonText, !isRegister ? authStyles.modeButtonTextActive : null]}>Connexion</Text>
            </Pressable>
            <Pressable
              style={[authStyles.modeButton, isRegister ? authStyles.modeButtonActive : null]}
              onPress={() => switchMode('register')}
              testID="auth-mode-register"
            >
              <Text style={[authStyles.modeButtonText, isRegister ? authStyles.modeButtonTextActive : null]}>Creation</Text>
            </Pressable>
          </View>

          {isRegister ? (
            <>
              <Text style={authStyles.label}>Nom d'utilisateur</Text>
              <TextInput
                style={authStyles.input}
                value={displayName}
                onChangeText={onDisplayNameChange}
                autoCorrect={false}
                placeholder="Nom d'utilisateur"
              />
            </>
          ) : null}

          <Text style={authStyles.label}>Adresse e-mail</Text>
          <TextInput
            style={authStyles.input}
            value={email}
            onChangeText={onEmailChange}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
          />

          <Text style={authStyles.label}>Mot de passe</Text>
          <TextInput
            style={authStyles.input}
            value={password}
            onChangeText={onPasswordChange}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Mot de passe"
          />

          {isRegister ? (
            <>
              <Text style={authStyles.label}>Confirmation du mot de passe</Text>
              <TextInput
                style={authStyles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Confirme ton mot de passe"
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
              {submitting ? 'Traitement...' : isRegister ? 'Creer un compte' : 'Se connecter'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => switchMode(isRegister ? 'login' : 'register')}
            style={authStyles.switchModeLink}
            testID="auth-switch-mode-link"
          >
            <Text style={authStyles.switchModeLinkText}>
              {isRegister ? 'Deja un compte ? Se connecter' : 'Pas encore de compte ? Creer un compte'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setShowAdvanced((current) => !current)}
            style={authStyles.advancedToggle}
            testID="auth-advanced-toggle"
          >
            <Text style={authStyles.advancedToggleText}>
              {showAdvanced ? 'Masquer options API' : 'Afficher options API'}
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
                Simulateur iOS: localhost. Telephone physique: IP locale du Mac (meme Wi-Fi).
              </Text>
            </View>
          ) : null}

          {localError ? <Text style={authStyles.errorText}>{localError}</Text> : null}
          <Text style={authStyles.statusText}>{status}</Text>
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
  heroLeftDecoration: {
    position: 'absolute',
    left: -20,
    bottom: -34,
    width: 170,
    height: 200,
    opacity: 0.66
  },
  heroRightDecoration: {
    position: 'absolute',
    right: -24,
    bottom: -24,
    width: 160,
    height: 200,
    opacity: 0.86
  },
  heroBirdDecoration: {
    position: 'absolute',
    right: 26,
    top: 30,
    width: 54,
    height: 72,
    opacity: 0.9
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    zIndex: 1
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 8
  },
  brandTextCol: {
    gap: 0
  },
  brandTitle: {
    fontSize: 52,
    lineHeight: 50,
    color: '#f2fbf4',
    fontWeight: '900'
  },
  brandSubtitle: {
    marginTop: 4,
    fontSize: 20,
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
    borderRadius: 14,
    padding: 4,
    backgroundColor: '#e3ebe3',
    marginBottom: 4
  },
  modeButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center'
  },
  modeButtonActive: {
    backgroundColor: '#1f6e4b'
  },
  modeButtonText: {
    fontSize: 15,
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
    paddingVertical: 15,
    alignItems: 'center'
  },
  primaryButtonDisabled: {
    opacity: 0.7
  },
  primaryButtonText: {
    color: '#f1fff4',
    fontSize: 22,
    fontWeight: '800'
  },
  switchModeLink: {
    alignItems: 'center',
    paddingTop: 8
  },
  switchModeLinkText: {
    color: '#236647',
    fontWeight: '700',
    fontSize: 16
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
