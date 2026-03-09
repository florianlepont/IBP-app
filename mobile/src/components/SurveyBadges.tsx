import { Text, View } from 'react-native';
import { styles } from '../app/styles';
import { LocalSurvey } from '../storage';

type SurveyBadgesProps = {
  survey: LocalSurvey;
};

export function SurveyBadges({ survey }: SurveyBadgesProps) {
  const isSubmitted = survey.status === 'submitted';

  return (
    <View style={styles.badgeRow}>
      <View style={[styles.badge, isSubmitted ? styles.badgeStatusSubmitted : styles.badgeStatusDraft]}>
        <Text style={styles.badgeText}>status: {survey.status}</Text>
      </View>
      <View
        style={[
          styles.badge,
          survey.sync_state === 'synced'
            ? styles.badgeSyncSynced
            : survey.sync_state === 'pending'
              ? styles.badgeSyncPending
              : styles.badgeSyncFailed
        ]}
      >
        <Text style={styles.badgeText}>sync: {survey.sync_state}</Text>
      </View>
      <View style={[styles.badge, styles.badgeNeutral]}>
        <Text style={styles.badgeText}>v{survey.sync_version}</Text>
      </View>
      <View style={[styles.badge, styles.badgeNeutral]}>
        <Text style={styles.badgeText}>visibility: {survey.visibility}</Text>
      </View>
      {survey.sync_blocked === 1 ? (
        <View style={[styles.badge, styles.badgeBlocked]}>
          <Text style={styles.badgeText}>blocked</Text>
        </View>
      ) : null}
    </View>
  );
}
