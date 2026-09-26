import { StyleSheet } from "react-native"

/**
 * Styles shared by the navigation tree and the route components (phase 01.9-24).
 * These are the last live keys of the former global stylesheet in src/app, deleted here.
 */
export const styles = StyleSheet.create({
  tabScreenContainer: {
    flex: 1,
    position: "relative",
  },
  mainScroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 20,
  },
  accountScreenWrap: {
    flex: 1,
  },
})
