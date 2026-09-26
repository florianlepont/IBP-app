import React from "react"
import renderer, { act } from "react-test-renderer"

const originalConsoleError = console.error

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const message = String(args[0] ?? "")
    if (message.includes("react-test-renderer is deprecated")) {
      return
    }
    if (message.includes("The current testing environment is not configured to support act")) {
      return
    }
    originalConsoleError(...(args as Parameters<typeof console.error>))
  })
})

afterAll(() => {
  jest.restoreAllMocks()
})

jest.mock("react-native", () => {
  const mockComponent = (name: string) => {
    const ReactRef = require("react") as typeof import("react")
    return ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactRef.createElement(name, props, children)
  }

  return {
    Text: mockComponent("Text"),
    TextInput: mockComponent("TextInput"),
    Pressable: mockComponent("Pressable"),
    Image: mockComponent("Image"),
    KeyboardAvoidingView: mockComponent("KeyboardAvoidingView"),
    ScrollView: mockComponent("ScrollView"),
    View: mockComponent("View"),
    Platform: {
      OS: "ios",
      select: (options: { ios?: unknown; android?: unknown; default?: unknown }): unknown =>
        options.ios ?? options.default,
    },
    StyleSheet: {
      create: <T extends object>(value: T): T => value,
    },
  }
})

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

import { fr } from "../i18n"
import { ProfileSetupScreen } from "./ProfileSetupScreen"

describe("ProfileSetupScreen", () => {
  it("submits trimmed first and last names", async () => {
    const onSave = jest.fn(async () => undefined)

    let component: renderer.ReactTestRenderer
    await act(async () => {
      component = renderer.create(
        React.createElement(ProfileSetupScreen, {
          saving: false,
          onSave,
          onSkip: jest.fn(),
        }),
      )
    })

    const firstNameInput = component!.root.findByProps({
      placeholder: fr.profileSetup.firstNamePlaceholder,
    })
    const lastNameInput = component!.root.findByProps({
      placeholder: fr.profileSetup.lastNamePlaceholder,
    })
    await act(async () => {
      firstNameInput.props.onChangeText("  Marie ")
      lastNameInput.props.onChangeText(" Dupont  ")
    })

    const submitButton = component!.root.findByProps({ accessibilityLabel: fr.profileSetup.start })
    await act(async () => {
      submitButton.props.onPress()
    })

    expect(onSave).toHaveBeenCalledWith("Marie", "Dupont")
  })

  it("calls the skip handler", async () => {
    const onSkip = jest.fn()

    let component: renderer.ReactTestRenderer
    await act(async () => {
      component = renderer.create(
        React.createElement(ProfileSetupScreen, {
          saving: false,
          onSave: jest.fn(async () => undefined),
          onSkip,
        }),
      )
    })

    const skipButton = component!.root.findByProps({ accessibilityLabel: fr.profileSetup.skip })
    await act(async () => {
      skipButton.props.onPress()
    })

    expect(onSkip).toHaveBeenCalledTimes(1)
  })
})
