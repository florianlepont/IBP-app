import { Text, View } from 'react-native';
import { formatSurveyUiStatusLabel, resolveSurveyUiStatus } from '../app/survey-logic';
import { styles } from '../app/styles';
import { LocalSurvey } from '../storage';

type SurveyBadgesProps = {
  survey: LocalSurvey;
};

export function SurveyBadges({ survey }: SurveyBadgesProps) {
  const uiStatus = resolveSurveyUiStatus(survey);
  const statusBadgeStyle =
    uiStatus === 'submitted'
      ? styles.badgeStatusSubmitted
      : uiStatus === 'expired' || uiStatus === 'sync_blocked'
        ? styles.badgeBlocked
        : uiStatus === 'sync_error'
          ? styles.badgeSyncFailed
          : uiStatus === 'sync_pending'
            ? styles.badgeSyncPending
            : styles.badgeStatusDraft;

  return (
    <View style={styles.badgeRow}>
      <View style={[styles.badge, statusBadgeStyle]}>
        <Text style={styles.badgeText}>state: {formatSurveyUiStatusLabel(uiStatus)}</Text>
      </View>
      <View style={[styles.badge, styles.badgeNeutral]}>
        <Text style={styles.badgeText}>visibility: {survey.visibility}</Text>
      </View>
    </View>
  );
}
