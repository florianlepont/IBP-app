import { Text, TextInput, View } from 'react-native';
import { FACTOR_INPUT_HINTS_BY_FACTOR, HELP_BY_FACTOR } from '../app/constants';
import { styles } from '../app/styles';
import { FactorField, FactorKey, FactorRetainedScore } from '../app/types';

type FactorDetailScreenProps = {
  factor: FactorKey;
  fields: FactorField[];
  retainedScore: FactorRetainedScore | null;
};

export function FactorDetailScreen({ factor, fields, retainedScore }: FactorDetailScreenProps) {
  const hints = FACTOR_INPUT_HINTS_BY_FACTOR[factor];
  const total = fields.length;
  const filled = fields.filter((field) => field.value.trim().length > 0).length;

  return (
    <View style={styles.card}>
      <View style={styles.factorDetailHeaderRow}>
        <View />
        <Text style={styles.factorDetailProgressText}>
          {filled}/{total}
        </Text>
      </View>

      <Text style={styles.factorDetailTitle}>Factor {factor}</Text>

      <View style={styles.factorRetainedScoreCard}>
        <Text style={styles.factorRetainedScoreLabel}>Score retenu</Text>
        <Text style={styles.factorRetainedScoreValue}>
          {retainedScore ? `${retainedScore.score} pts` : 'En attente'}
        </Text>
        <Text style={styles.factorRetainedScoreClass}>
          {retainedScore ? retainedScore.selected_class : 'Renseigne tous les champs requis'}
        </Text>
      </View>

      <View style={styles.factorExplainBanner}>
        <Text style={styles.factorExplainBannerTitle}>Guide terrain</Text>
        <Text style={styles.factorExplainBannerText}>{HELP_BY_FACTOR[factor]}</Text>
      </View>

      <View style={styles.factorHintCard}>
        <Text style={styles.factorHintTitle}>Quoi renseigner</Text>
        {hints.map((hint) => (
          <Text key={`hint-${factor}-${hint}`} style={styles.factorHintText}>
            - {hint}
          </Text>
        ))}
      </View>

      <View style={styles.factorDetailFieldsCard}>
        {fields.map((field) => (
          <View key={`${factor}-${field.label}`} style={styles.factorDetailFieldBlock}>
            <Text style={styles.label}>
              {field.label}
              {field.required ? ' *' : ''}
            </Text>
            <TextInput style={styles.input} value={field.value} onChangeText={field.onChange} keyboardType="numeric" />
            {field.error ? <Text style={styles.fieldError}>{field.error}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}
