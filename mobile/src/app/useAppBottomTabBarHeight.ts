import { createContext, useContext } from "react"
import { BottomTabBarHeightContext as NativeBottomTabBarHeightContext } from "react-native-bottom-tabs"

const FallbackBottomTabBarHeightContext = createContext<number | undefined>(undefined)

function getJsBottomTabBarHeightContext() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bottomTabs = require("@react-navigation/bottom-tabs") as {
      BottomTabBarHeightContext?: typeof FallbackBottomTabBarHeightContext
    }

    return bottomTabs.BottomTabBarHeightContext ?? FallbackBottomTabBarHeightContext
  } catch {
    return FallbackBottomTabBarHeightContext
  }
}

export function useAppBottomTabBarHeight(fallback = 0): number {
  const JsBottomTabBarHeightContext = getJsBottomTabBarHeightContext()
  const nativeHeight = useContext(NativeBottomTabBarHeightContext)
  const jsHeight = useContext(JsBottomTabBarHeightContext)

  return nativeHeight ?? jsHeight ?? fallback
}
