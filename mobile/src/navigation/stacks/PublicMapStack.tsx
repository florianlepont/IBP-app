import { View } from "react-native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { PublicMapRoute } from "../routes/PublicMapRoute"
import { styles } from "../styles"
import type { PublicMapStackParamList } from "../types"
import { baseStackScreenOptions } from "./stack-options"

const PublicMapStack = createNativeStackNavigator<PublicMapStackParamList>()

export function PublicMapTabNavigator() {
  return (
    <View style={styles.tabScreenContainer}>
      <PublicMapStack.Navigator screenOptions={{ ...baseStackScreenOptions, headerShown: false }}>
        <PublicMapStack.Screen name="publicMapHome" component={PublicMapRoute} />
      </PublicMapStack.Navigator>
    </View>
  )
}
