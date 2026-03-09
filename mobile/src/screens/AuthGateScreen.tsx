import { Button, Text, TextInput, View } from 'react-native';
import { styles } from '../app/styles';

type AuthGateScreenProps = {
  apiUrl: string;
  onApiUrlChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  onLogin: () => Promise<void>;
  status: string;
};

export function AuthGateScreen({
  apiUrl,
  onApiUrlChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  onLogin,
  status
}: AuthGateScreenProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Login</Text>
      <Text style={styles.meta}>Please authenticate before accessing surveys.</Text>

      <Text style={styles.label}>API URL</Text>
      <TextInput style={styles.input} value={apiUrl} onChangeText={onApiUrlChange} autoCapitalize="none" autoCorrect={false} />

      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} value={email} onChangeText={onEmailChange} autoCapitalize="none" autoCorrect={false} />

      <Text style={styles.label}>Password</Text>
      <TextInput style={styles.input} value={password} onChangeText={onPasswordChange} secureTextEntry />

      <Button title="Login" onPress={() => void onLogin()} />
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}
