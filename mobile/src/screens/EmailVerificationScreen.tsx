import { useState } from "react"
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  brandColors,
  brandRadius,
  brandShadow,
  brandSpacing,
  brandTypography,
} from "../app/brand-tokens"

type EmailVerificationScreenProps = {
  email: string
  onVerify: (token: string) => Promise<void>
  onResend: () => Promise<void>
  onBack: () => void
}

export function EmailVerificationScreen({
  email,
  onVerify,
  onResend,
  onBack,
}: EmailVerificationScreenProps) {
  const insets = useSafeAreaInsets()
  const [token, setToken] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState("")
  const [resendSuccess, setResendSuccess] = useState(false)

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
      <View style={[styles.screen, { paddingTop: insets.top + brandSpacing.lg }]}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backButton} testID="verify-back">
            <Text style={styles.backText}>← Back to sign in</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            We sent a verification code to <Text style={styles.emailHighlight}>{email}</Text>
            {". "}
            Enter it below to activate your account.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Verification code</Text>
            <TextInput
              style={styles.input}
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Paste your code here"
              placeholderTextColor={brandColors.textSecondary}
              testID="verify-token-input"
            />

            <Pressable
              style={[styles.primaryButton, submitting ? styles.primaryButtonDisabled : null]}
              onPress={() => void handleVerify()}
              disabled={submitting}
              testID="verify-submit"
            >
              <Text style={styles.primaryButtonText}>
                {submitting ? "Verifying..." : "Verify email"}
              </Text>
            </Pressable>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {resendSuccess && !error ? (
              <Text style={styles.successText}>A new code has been sent to your inbox.</Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => void handleResend()}
            disabled={resending}
            style={styles.resendButton}
            testID="verify-resend"
          >
            <Text style={styles.resendText}>
              {resending ? "Sending..." : "Didn't receive the email? Resend"}
            </Text>
          </Pressable>
        </View>
      </View>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: brandColors.canvas,
    paddingHorizontal: brandSpacing.lg,
  },
  header: {
    marginBottom: brandSpacing.lg,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingRight: 12,
  },
  backText: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  content: {
    flex: 1,
    gap: 20,
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
    borderRadius: brandRadius.card,
    backgroundColor: brandColors.white,
    borderWidth: 1,
    borderColor: brandColors.panelMuted,
    padding: 14,
    gap: 8,
    ...brandShadow.card,
  },
  label: {
    ...brandTypography.label,
    color: brandColors.textPrimary,
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    borderRadius: brandRadius.field,
    paddingHorizontal: 16,
    minHeight: 48,
    paddingVertical: 10,
    backgroundColor: brandColors.inputFill,
    color: brandColors.textPrimary,
    ...brandTypography.input,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "500",
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.textPrimary,
    minHeight: 46,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    ...brandTypography.button,
    color: brandColors.white,
    textAlign: "center",
  },
  errorText: {
    borderRadius: 16,
    backgroundColor: brandColors.errorSoft,
    color: "#6B2E1C",
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...brandTypography.sectionBody,
  },
  successText: {
    borderRadius: 16,
    backgroundColor: brandColors.successSoft,
    color: brandColors.forest,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...brandTypography.sectionBody,
  },
  resendButton: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  resendText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
})
