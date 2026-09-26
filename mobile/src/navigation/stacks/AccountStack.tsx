import { Pressable, View } from "react-native"
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack"
import { Ionicons } from "@expo/vector-icons"
import { brandColors } from "../../app/brand-tokens"
import { fr } from "../../i18n"
import { AccountRoute } from "../routes/AccountRoute"
import { SettingsRoute } from "../routes/SettingsRoute"
import { styles } from "../styles"
import type { AccountStackParamList } from "../types"
import { baseStackScreenOptions } from "./stack-options"

const AccountStack = createNativeStackNavigator<AccountStackParamList>()

function HeaderIconButton({
  icon,
  accessibilityLabel,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  accessibilityLabel: string
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name={icon} size={22} color={brandColors.forest} />
    </Pressable>
  )
}

function accountHomeOptions({
  navigation,
}: NativeStackScreenProps<AccountStackParamList, "accountHome">): NativeStackNavigationOptions {
  return {
    title: fr.navigation.headers.account,
    headerLargeTitle: false,
    headerRight: () => (
      <HeaderIconButton
        icon="settings-outline"
        accessibilityLabel={fr.navigation.a11y.openSettings}
        onPress={() => navigation.navigate("settings")}
      />
    ),
  }
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
          options={accountHomeOptions}
          component={AccountRoute}
        />
        <AccountStack.Screen
          name="settings"
          options={{ title: fr.navigation.headers.settings }}
          component={SettingsRoute}
        />
      </AccountStack.Navigator>
    </View>
  )
}
