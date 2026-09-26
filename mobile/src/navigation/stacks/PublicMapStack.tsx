import { View } from "react-native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { styles } from "../../app/styles"
import { PublicMapRoute } from "../routes/PublicMapRoute"
import type { PublicMapStackParamList } from "../types"
import { baseStackScreenOptions } from "./stack-options"

const PublicMapStack = createNativeStackNavigator<PublicMapStackParamList>()

export function PublicMapTabNavigator() {
  return (
    <View style={styles.tabScreenContainer}>
      <PublicMapStack.Navigator screenOptions={{ ...baseStackScreenOptions, headerShown: false }}>
        <PublicMapStack.Screen name="publicMapHome">
          {(props) => <PublicMapRoute {...props} />}
        </PublicMapStack.Screen>
      </PublicMapStack.Navigator>
    </View>
  )
}
