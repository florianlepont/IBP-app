import { View } from "react-native"
import { SurveyDetailTab } from "../../app/types"
import { AppChoiceChip } from "../../ui/AppChoiceChip"
import { styles } from "./styles"

type DetailTabBarProps = {
  activeTab: SurveyDetailTab
  onSelectTab: (tab: SurveyDetailTab) => void
}

export function DetailTabBar({ activeTab, onSelectTab }: DetailTabBarProps) {
  return (
    <View style={styles.filterChipsRow}>
      <AppChoiceChip
        label="Summary"
        active={activeTab === "summary"}
        onPress={() => onSelectTab("summary")}
      />
      <AppChoiceChip
        label="Events"
        active={activeTab === "events"}
        onPress={() => onSelectTab("events")}
      />
      <AppChoiceChip
        label="Debug"
        active={activeTab === "debug"}
        onPress={() => onSelectTab("debug")}
      />
    </View>
  )
}
