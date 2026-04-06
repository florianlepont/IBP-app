import { ImageSourcePropType } from "react-native"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { AuthGateScreen } from "../screens/AuthGateScreen"

type PreAuthParamList = {
  AuthGate: undefined
}

const Stack = createNativeStackNavigator<PreAuthParamList>()

type PreAuthNavigatorProps = {
  apiUrl: string
  onApiUrlChange: (value: string) => void
  onLogin: () => Promise<void>
  status: string
  logoSource?: ImageSourcePropType
  heroMartenSource?: ImageSourcePropType
}

export function PreAuthNavigator({
  apiUrl,
  onApiUrlChange,
  onLogin,
  status,
  logoSource,
  heroMartenSource,
}: PreAuthNavigatorProps) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="AuthGate">
          {() => (
            <AuthGateScreen
              apiUrl={apiUrl}
              onApiUrlChange={onApiUrlChange}
              onLogin={onLogin}
              status={status}
              logoSource={logoSource}
              heroMartenSource={heroMartenSource}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  )
}
