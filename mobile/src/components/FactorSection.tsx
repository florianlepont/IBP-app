import { Text, TextInput, View } from 'react-native';
import { styles } from '../app/styles';
import { FactorField, FactorKey } from '../app/types';

type FactorSectionProps = {
  factorKey: FactorKey;
  helpText: string;
  fields: FactorField[];
};

export function FactorSection({ factorKey, helpText, fields }: FactorSectionProps) {
  return (
    <View style={styles.helpCard} key={factorKey}>
      <View style={styles.helpHeader}>
        <Text style={styles.label}>Factor {factorKey}</Text>
      </View>
      <Text style={styles.helpText}>{helpText}</Text>
      <View style={styles.factorGrid}>
        {fields.map((field) => (
          <View key={`${factorKey}-${field.label}`} style={styles.factorItemWide}>
            <Text style={styles.factorKey}>{field.label}</Text>
            <TextInput style={styles.factorInput} value={field.value} onChangeText={field.onChange} keyboardType="numeric" />
          </View>
        ))}
      </View>
    </View>
  );
}
