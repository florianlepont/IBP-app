import { Pressable, View } from "react-native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { Ionicons } from "@expo/vector-icons"
import { brandColors } from "../../app/brand-tokens"
import { styles } from "../../app/styles"
import { AccountRoute } from "../routes/AccountRoute"
import { SettingsRoute } from "../routes/SettingsRoute"
import type { AccountStackParamList } from "../types"
import { baseStackScreenOptions } from "./stack-options"

const AccountStack = createNativeStackNavigator<AccountStackParamList>()

function HeaderIconButton({
  icon,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name={icon} size={22} color={brandColors.forest} />
    </Pressable>
  )
}

export function AccountTabNavigator() {
  return (
    <View style={styles.tabScreenContainer}>
      <AccountStack.Navigator
        screenOptions={{
          ...baseStackScreenOptions,
          headerLargeTitle: false,
        }}
      >
        <AccountStack.Screen
          name="accountHome"
          options={({ navigation }) => ({
            title: "Compte",
            headerLargeTitle: false,
            headerRight: () => (
              <HeaderIconButton
                icon="settings-outline"
                onPress={() => navigation.navigate("settings")}
              />
            ),
          })}
        >
          {(props) => <AccountRoute {...props} />}
        </AccountStack.Screen>
        <AccountStack.Screen name="settings" options={{ title: "Paramètres" }}>
          {(props) => <SettingsRoute {...props} />}
        </AccountStack.Screen>
      </AccountStack.Navigator>
    </View>
  )
}
