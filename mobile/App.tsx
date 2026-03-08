import { useMemo, useState } from 'react';
import { Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';

const DEFAULT_API_URL = 'http://localhost:3000/v1';

type HealthPayload = {
  status: string;
  service: string;
  timestamp: string;
};

export default function App() {
  const apiUrl = useMemo(() => process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL, []);
  const [result, setResult] = useState<string>('Not checked yet');

  const checkApi = async (): Promise<void> => {
    try {
      const response = await fetch(`${apiUrl}/health`);
      if (!response.ok) {
        setResult(`HTTP ${response.status}`);
        return;
      }

      const data = (await response.json()) as HealthPayload;
      setResult(`${data.status} (${data.service}) at ${data.timestamp}`);
    } catch (error) {
      setResult(`Error: ${(error as Error).message}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>IBP Mobile Scaffold</Text>
        <Text style={styles.subtitle}>API URL: {apiUrl}</Text>
        <Button title="Check API /health" onPress={checkApi} />
        <Text style={styles.result}>{result}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f7fb',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    gap: 14
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1b3557'
  },
  subtitle: {
    fontSize: 14,
    color: '#3d546f'
  },
  result: {
    fontSize: 14,
    color: '#0d2742'
  }
});
