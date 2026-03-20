import { Pressable, Text, View } from "react-native"
import { styles } from "../app/styles"
import { AppScreen } from "../app/types"

type MainTab = Exclude<AppScreen, "edit">

type BottomTabBarProps = {
  activeTab: MainTab
  onSelectTab: (tab: MainTab) => void
}

const TAB_ITEMS: Array<{ key: MainTab; label: string }> = [
  { key: "list", label: "Surveys" },
  { key: "create", label: "New" },
  { key: "public_map", label: "Map" },
  { key: "profile", label: "Account" },
]

export function BottomTabBar({ activeTab, onSelectTab }: BottomTabBarProps) {
  return (
    <View style={styles.tabBar}>
      {TAB_ITEMS.map((tab) => {
        const active = tab.key === activeTab
        return (
          <Pressable
            key={tab.key}
            style={[styles.tabButton, active ? styles.tabButtonActive : null]}
            onPress={() => onSelectTab(tab.key)}
          >
            <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}>
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
