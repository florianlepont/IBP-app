import { useState, type Ref } from "react"
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native"
import {
  brandColors,
  brandComponentTokens,
  brandRadius,
  brandTypography,
} from "../app/brand-tokens"

type AppFieldProps = {
  label: string
  error?: string | null
  inputRef?: Ref<TextInput>
  containerStyle?: StyleProp<ViewStyle>
  labelStyle?: StyleProp<TextStyle>
  inputStyle?: StyleProp<TextStyle>
  testID?: string
} & TextInputProps

export function AppField({
  label,
  error,
  inputRef,
  containerStyle,
  labelStyle,
  inputStyle,
  testID,
  placeholderTextColor = brandColors.textSecondary,
  onFocus,
  onBlur,
  ...inputProps
}: AppFieldProps) {
  const [focused, setFocused] = useState(false)

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          focused ? styles.inputFocused : null,
          error ? styles.inputError : null,
          inputStyle,
        ]}
        placeholderTextColor={placeholderTextColor}
        testID={testID}
        onFocus={(event) => {
          setFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          onBlur?.(event)
        }}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: brandComponentTokens.field.gap,
  },
  label: {
    ...brandTypography.label,
    color: brandColors.textPrimary,
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: brandComponentTokens.field.border,
    borderRadius: brandRadius.field,
    paddingHorizontal: brandComponentTokens.field.horizontalPadding,
    minHeight: brandComponentTokens.field.minHeight,
    paddingVertical: brandComponentTokens.field.verticalPadding,
    backgroundColor: brandComponentTokens.field.background,
    color: brandColors.textPrimary,
    ...brandTypography.input,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "500",
  },
  inputFocused: {
    borderColor: brandColors.forest,
    backgroundColor: brandColors.white,
    shadowColor: brandColors.forest,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  inputError: {
    borderColor: brandComponentTokens.field.borderError,
  },
  error: {
    ...brandTypography.meta,
    color: brandComponentTokens.field.borderError,
  },
})
