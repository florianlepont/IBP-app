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

  const animatedValue = () => ({
    interpolate: jest.fn(() => ({})),
    setValue: jest.fn(),
  })

  const Animated = {
    Value: jest.fn(() => animatedValue()),
    View: mockComponent("Animated.View"),
    Image: mockComponent("Animated.Image"),
    timing: jest.fn(() => ({ start: jest.fn() })),
    sequence: jest.fn((anims: { start: (cb?: () => void) => void }[]) => ({
      start: (cb?: () => void) => {
        anims.forEach((a) => a.start())
        cb?.()
      },
    })),
    stagger: jest.fn((_delay: number, anims: { start: (cb?: () => void) => void }[]) => ({
      start: (cb?: () => void) => {
        anims.forEach((a) => a.start())
        cb?.()
      },
    })),
  }

  return {
    Animated,
    Text: mockComponent("Text"),
    TextInput: mockComponent("TextInput"),
    Pressable: mockComponent("Pressable"),
    Image: mockComponent("Image"),
    ImageBackground: mockComponent("ImageBackground"),
    KeyboardAvoidingView: mockComponent("KeyboardAvoidingView"),
    ScrollView: mockComponent("ScrollView"),
    StatusBar: mockComponent("StatusBar"),
    TouchableWithoutFeedback: mockComponent("TouchableWithoutFeedback"),
    View: mockComponent("View"),
    ActivityIndicator: mockComponent("ActivityIndicator"),
    Platform: {
      OS: "ios",
      select: <T>(options: { ios?: T; android?: T; default?: T }): T | undefined =>
        options.ios ?? options.default,
    },
    Keyboard: {
      dismiss: jest.fn(),
    },
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
    StyleSheet: {
      create: <T extends object>(value: T): T => value,
    },
  }
})

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

import { AuthGateScreen } from "./AuthGateScreen"

describe("AuthGateScreen", () => {
  it("calls login handler when pressing the login button", async () => {
    const onLogin = jest.fn(async () => undefined)

    let component: renderer.ReactTestRenderer
    await act(async () => {
      component = renderer.create(
        React.createElement(AuthGateScreen, {
          apiUrl: "http://localhost:3000/v1",
          onApiUrlChange: jest.fn(),
          onLogin,
          status: "Ready",
        }),
      )
    })

    const submitButton = component!.root.findByProps({ testID: "auth-submit" })
    await act(async () => {
      submitButton.props.onPress()
    })

    expect(onLogin).toHaveBeenCalledTimes(1)
  })
})
