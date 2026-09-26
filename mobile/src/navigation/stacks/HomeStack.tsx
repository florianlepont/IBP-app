import { View } from "react-native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { HomeRoute } from "../routes/HomeRoute"
import { styles } from "../styles"
import type { HomeStackParamList } from "../types"
import { baseStackScreenOptions } from "./stack-options"

const HomeStack = createNativeStackNavigator<HomeStackParamList>()

export function HomeTabNavigator() {
  return (
    <View style={styles.tabScreenContainer}>
      <HomeStack.Navigator screenOptions={{ ...baseStackScreenOptions, headerShown: false }}>
        <HomeStack.Screen name="homeRoot" component={HomeRoute} />
      </HomeStack.Navigator>
    </View>
  )
}
