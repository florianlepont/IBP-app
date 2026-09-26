import { Platform } from "react-native"
import * as Haptics from "expo-haptics"

// Light tap feedback on iOS, shared by the survey list screen and its rows.
export function triggerHaptic(): void {
  if (Platform.OS === "ios") {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }
}
