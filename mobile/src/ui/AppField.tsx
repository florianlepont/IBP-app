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
  containerStyle?: StyleProp<ViewStyle>
  labelStyle?: StyleProp<TextStyle>
  inputStyle?: StyleProp<TextStyle>
  testID?: string
} & TextInputProps

export function AppField({
  label,
  error,
  containerStyle,
  labelStyle,
  inputStyle,
  testID,
  placeholderTextColor = brandColors.textSecondary,
  ...inputProps
}: AppFieldProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, inputStyle]}
        placeholderTextColor={placeholderTextColor}
        testID={testID}
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
  inputError: {
    borderColor: brandComponentTokens.field.borderError,
  },
  error: {
    ...brandTypography.meta,
    color: brandComponentTokens.field.borderError,
  },
})
