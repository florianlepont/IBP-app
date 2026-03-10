import { Text, View } from 'react-native';
import {
  formatSurveySyncDisplayLabel,
  formatSurveyWorkflowStatusLabel,
  resolveSurveySyncDisplay,
  resolveSurveyWorkflowStatus
} from '../app/survey-logic';
import { styles } from '../app/styles';
import { LocalSurvey } from '../storage';

type SurveyBadgesProps = {
  survey: LocalSurvey;
};

export function SurveyBadges({ survey }: SurveyBadgesProps) {
  const workflowStatus = resolveSurveyWorkflowStatus(survey);
  const syncDisplay = resolveSurveySyncDisplay(survey);

  const workflowBadgeStyle =
    workflowStatus === 'submitted'
      ? styles.badgeStatusSubmitted
      : workflowStatus === 'expired'
        ? styles.badgeBlocked
        : workflowStatus === 'pending'
          ? styles.badgeSyncPending
          : styles.badgeStatusDraft;

  const syncBadgeStyle =
    syncDisplay === 'sync'
      ? styles.badgeSyncSynced
      : syncDisplay === 'sync_error'
        ? styles.badgeSyncFailed
        : syncDisplay === 'sync_blocked'
          ? styles.badgeBlocked
          : styles.badgeNeutral;

  return (
    <View style={styles.badgeRow}>
      <View style={[styles.badge, workflowBadgeStyle]}>
        <Text style={styles.badgeText}>{formatSurveyWorkflowStatusLabel(workflowStatus)}</Text>
      </View>
      <View style={[styles.badge, syncBadgeStyle]}>
        <Text style={styles.badgeText}>{formatSurveySyncDisplayLabel(syncDisplay)}</Text>
      </View>
      <View style={[styles.badge, styles.badgeNeutral]}>
        <Text style={styles.badgeText}>{survey.visibility}</Text>
      </View>
    </View>
  );
}
