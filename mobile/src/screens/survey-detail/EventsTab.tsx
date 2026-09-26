import { Text, View } from "react-native"
import { formatDateTime, formatEventPayload } from "../../app/formatters"
import { SurveyEventItem } from "../../app/types"
import { AppButton } from "../../ui/AppButton"
import { AppCard } from "../../ui/AppCard"
import { AppSectionHeader } from "../../ui/AppSectionHeader"
import { styles as sharedStyles } from "./styles"
import { styles } from "./tabs.styles"

type EventsTabProps = {
  events: SurveyEventItem[]
  isLoading: boolean
  onReload: () => void
}

export function EventsTab({ events, isLoading, onReload }: EventsTabProps) {
  return (
    <View style={sharedStyles.detailSection}>
      <AppCard variant="panelElevated" padding={18} style={styles.eventsCard}>
        <AppSectionHeader
          title="Survey events"
          subtitle="Sync and workflow history for this record."
          trailing={
            <AppButton
              label="Reload"
              variant="secondary"
              size="sm"
              leadingIcon="refresh-outline"
              onPress={onReload}
            />
          }
        />
        {isLoading ? <Text style={sharedStyles.rowMeta}>Loading events...</Text> : null}
        {events.length === 0 && !isLoading ? (
          <Text style={sharedStyles.rowMeta}>No events loaded yet.</Text>
        ) : null}
        {events.map((event) => (
          <View key={event.id} style={styles.eventRow}>
            <Text style={styles.eventTitle}>{event.event_type}</Text>
            <Text style={sharedStyles.rowMeta}>{formatDateTime(event.created_at)}</Text>
            {formatEventPayload(event.payload) ? (
              <Text style={styles.eventPayload}>{formatEventPayload(event.payload)}</Text>
            ) : null}
          </View>
        ))}
      </AppCard>
    </View>
  )
}
