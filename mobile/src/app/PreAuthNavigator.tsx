import { useEffect, useRef } from "react"
import { ImageSourcePropType } from "react-native"
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { AuthGateScreen } from "../screens/AuthGateScreen"
import { EmailVerificationScreen } from "../screens/EmailVerificationScreen"

type PreAuthParamList = {
  AuthGate: undefined
  EmailVerification: { email: string; devToken?: string }
}

const Stack = createNativeStackNavigator<PreAuthParamList>()

type PreAuthNavigatorProps = {
  apiUrl: string
  onApiUrlChange: (value: string) => void
  email: string
  onEmailChange: (value: string) => void
  password: string
  onPasswordChange: (value: string) => void
  displayName: string
  onDisplayNameChange: (value: string) => void
  onLogin: () => Promise<void>
  onRegister: () => Promise<void>
  status: string
  logoSource?: ImageSourcePropType
  heroMartenSource?: ImageSourcePropType
  pendingEmailVerification: string | null
  devVerificationToken: string | null
  onVerifyEmail: (token: string) => Promise<void>
  onResendVerification: () => Promise<void>
  onCancelEmailVerification: () => Promise<void>
}

export function PreAuthNavigator({
  apiUrl,
  onApiUrlChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  displayName,
  onDisplayNameChange,
  onLogin,
  onRegister,
  status,
  logoSource,
  heroMartenSource,
  pendingEmailVerification,
  devVerificationToken,
  onVerifyEmail,
  onResendVerification,
  onCancelEmailVerification,
}: PreAuthNavigatorProps) {
  const navRef = useRef<NavigationContainerRef<PreAuthParamList>>(null)

  useEffect(() => {
    if (!navRef.current) return
    if (pendingEmailVerification) {
      navRef.current.navigate("EmailVerification", {
        email: pendingEmailVerification,
        devToken: devVerificationToken ?? undefined,
      })
    } else {
      navRef.current.navigate("AuthGate", undefined)
    }
  }, [pendingEmailVerification, devVerificationToken])

  return (
    <NavigationContainer ref={navRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="AuthGate">
          {() => (
            <AuthGateScreen
              apiUrl={apiUrl}
              onApiUrlChange={onApiUrlChange}
              email={email}
              onEmailChange={onEmailChange}
              password={password}
              onPasswordChange={onPasswordChange}
              displayName={displayName}
              onDisplayNameChange={onDisplayNameChange}
              onLogin={onLogin}
              onRegister={onRegister}
              status={status}
              logoSource={logoSource}
              heroMartenSource={heroMartenSource}
            />
          )}
        </Stack.Screen>

        <Stack.Screen
          name="EmailVerification"
          options={{
            headerShown: true,
            title: "",
            headerBackTitle: "Sign in",
          }}
        >
          {({ route }) => (
            <EmailVerificationScreen
              email={route.params.email}
              devToken={route.params.devToken}
              onVerify={onVerifyEmail}
              onResend={onResendVerification}
              onBack={onCancelEmailVerification}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  )
}
