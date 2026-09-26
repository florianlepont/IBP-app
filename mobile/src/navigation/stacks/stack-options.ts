import { Platform } from "react-native"
import { brandColors } from "../../app/brand-tokens"

/** Screen options shared by every stack navigator. */
export const baseStackScreenOptions = {
  headerBackButtonDisplayMode: "minimal" as const,
  contentStyle: { backgroundColor: brandColors.canvas },
  ...(Platform.OS === "ios"
    ? {
        headerTransparent: true,
        headerBlurEffect: "systemMaterial" as const,
      }
    : {
        headerStyle: { backgroundColor: brandColors.canvas },
        headerShadowVisible: false,
        headerTintColor: brandColors.forest,
        headerTitleStyle: {
          color: brandColors.forest,
          fontSize: 18,
          fontWeight: "800" as const,
        },
      }),
}
