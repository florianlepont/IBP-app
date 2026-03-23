import { useEffect, useRef, useState } from "react"
import {
  BackHandler,
  Keyboard,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { brandColors, brandSpacing, brandTypography } from "../app/brand-tokens"
import { AppButton } from "../ui/AppButton"
import { AppCard } from "../ui/AppCard"
import { AppField } from "../ui/AppField"
import { AppNotice } from "../ui/AppNotice"

type EmailVerificationScreenProps = {
  email: string
  devToken?: string
  onVerify: (token: string) => Promise<void>
  onResend: () => Promise<void>
  onBack: () => void | Promise<void>
}

export function EmailVerificationScreen({
  email,
  devToken,
  onVerify,
  onResend,
  onBack,
}: EmailVerificationScreenProps) {
  const navigation = useNavigation()
  const verificationSucceeded = useRef(false)
  const [token, setToken] = useState(devToken ?? "")

  // Sync if devToken arrives after mount (login → auto-resend path)
  useEffect(() => {
    if (devToken && !token) {
      setToken(devToken)
    }
  }, [devToken, token])
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState("")
  const [resendSuccess, setResendSuccess] = useState(false)

  // Call onBack (cancel) when the screen is removed — unless verification succeeded.
  // This handles both the native header back button and the iOS swipe-back gesture.
  useEffect(() => {
    return navigation.addListener("beforeRemove", () => {
      if (!verificationSucceeded.current) {
        void onBack()
      }
    })
  }, [navigation, onBack])

  // Android hardware back button
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      void onBack()
      navigation.goBack()
      return true
    })
    return () => sub.remove()
  }, [navigation, onBack])

  const handleVerify = async (): Promise<void> => {
    const trimmed = token.trim()
    if (!trimmed) {
      setError("Enter the verification code from your email.")
      return
    }

    try {
      Keyboard.dismiss()
      setError("")
      setSubmitting(true)
      await onVerify(trimmed)
      verificationSucceeded.current = true
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async (): Promise<void> => {
    try {
      setResending(true)
      setResendSuccess(false)
      setError("")
      await onResend()
      setResendSuccess(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setResending(false)
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.screen}>
        <View style={styles.content}>
          {devToken ? (
            <AppNotice
              tone="warning"
              title="DEV"
              message={`Token pre-rempli: ${devToken}`}
              icon="construct-outline"
              style={styles.devBanner}
              messageStyle={styles.devBannerToken}
            />
          ) : null}
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            We sent a verification code to <Text style={styles.emailHighlight}>{email}</Text>
            {". "}
            Enter it below to activate your account.
          </Text>

          <AppCard variant="surface" padding={14} style={styles.card}>
            <AppField
              label="Verification code"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Paste your code here"
              testID="verify-token-input"
              inputStyle={styles.input}
            />

            <AppButton
              label={submitting ? "Verifying..." : "Verify email"}
              onPress={() => void handleVerify()}
              disabled={submitting}
              style={styles.primaryButton}
              testID="verify-submit"
            />

            {error ? <AppNotice tone="danger" message={error} icon="alert-circle-outline" /> : null}
            {resendSuccess && !error ? (
              <AppNotice
                tone="success"
                message="A new code has been sent to your inbox."
                icon="mail-outline"
              />
            ) : null}
          </AppCard>

          <AppButton
            label={resending ? "Sending..." : "Didn't receive the email? Resend"}
            variant="secondary"
            size="sm"
            onPress={() => void handleResend()}
            disabled={resending}
            style={styles.resendButton}
            testID="verify-resend"
          />
        </View>
      </View>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },
  content: {
    flex: 1,
    gap: 20,
    paddingHorizontal: brandSpacing.lg,
    paddingTop: brandSpacing.lg,
  },
  title: {
    ...brandTypography.sectionTitle,
    color: brandColors.textPrimary,
    fontSize: 24,
  },
  subtitle: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
    lineHeight: 22,
  },
  emailHighlight: {
    color: brandColors.textPrimary,
    fontWeight: "600",
  },
  card: {
    gap: 8,
  },
  input: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "500",
  },
  primaryButton: {
    marginTop: 8,
  },
  resendButton: {
    alignSelf: "center",
  },
  devBanner: {
    alignItems: "flex-start",
  },
  devBannerToken: {
    ...brandTypography.meta,
    color: "#7A5800",
  },
})
