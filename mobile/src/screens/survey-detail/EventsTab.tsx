import { Text, View } from "react-native"
import { formatDateTime } from "../../app/formatters"
import { SurveyEventItem } from "../../app/types"
import { fr } from "../../i18n"
import { AppButton } from "../../ui/AppButton"
import { AppCard } from "../../ui/AppCard"
import { AppSectionHeader } from "../../ui/AppSectionHeader"
import { eventTypeLabel } from "./event-labels"
import { styles as sharedStyles } from "./styles"
import { styles } from "./tabs.styles"

type EventsTabProps = {
  events: SurveyEventItem[]
  isLoading: boolean
  onReload: () => void
}

const t = fr.surveyDetail.events

// The survey history as French labels and dates. Raw payloads and ids stay in
// the dev-only DebugTab (D-06).
export function EventsTab({ events, isLoading, onReload }: EventsTabProps) {
  return (
    <View style={sharedStyles.detailSection}>
      <AppCard variant="panelElevated" padding={18} style={styles.eventsCard}>
        <AppSectionHeader
          title={t.title}
          subtitle={t.subtitle}
          trailing={
            <AppButton
              label={t.reload}
              variant="secondary"
              size="sm"
              leadingIcon="refresh-outline"
              onPress={onReload}
            />
          }
        />
        {isLoading ? <Text style={sharedStyles.rowMeta}>{t.loading}</Text> : null}
        {events.length === 0 && !isLoading ? (
          <Text style={sharedStyles.rowMeta}>{t.empty}</Text>
        ) : null}
        {events.map((event) => (
          <View key={event.id} style={styles.eventRow}>
            <Text style={styles.eventTitle}>{eventTypeLabel(event.event_type)}</Text>
            <Text style={sharedStyles.rowMeta}>{formatDateTime(event.created_at)}</Text>
          </View>
        ))}
      </AppCard>
    </View>
  )
}
