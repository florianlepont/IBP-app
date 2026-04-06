import React from "react"
import renderer, { act } from "react-test-renderer"

const originalConsoleError = console.error

jest.mock("@react-navigation/native", () => {
  const ReactRef = require("react") as typeof import("react")
  return {
    NavigationContainer: ({ children }: { children?: React.ReactNode }) =>
      ReactRef.createElement("NavigationContainer", {}, children),
  }
})

jest.mock("@react-navigation/native-stack", () => {
  const ReactRef = require("react") as typeof import("react")
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: { children?: React.ReactNode }) =>
        ReactRef.createElement("Stack.Navigator", {}, children),
      Screen: ({ children }: { children?: (args: Record<string, unknown>) => React.ReactNode }) =>
        ReactRef.createElement(
          "Stack.Screen",
          {},
          typeof children === "function" ? children({}) : children,
        ),
    }),
  }
})

jest.mock("../screens/AuthGateScreen", () => {
  const ReactRef = require("react") as typeof import("react")
  return {
    AuthGateScreen: (props: Record<string, unknown>) =>
      ReactRef.createElement("AuthGateScreen", props),
  }
})

import { PreAuthNavigator } from "./PreAuthNavigator"

describe("PreAuthNavigator", () => {
  const baseProps = {
    apiUrl: "https://api.example.com",
    onApiUrlChange: jest.fn(),
    onLogin: jest.fn(async () => undefined),
    status: "Ready",
  }

  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const message = String(args[0] ?? "")
      if (message.includes("react-test-renderer is deprecated")) {
        return
      }
      originalConsoleError(...(args as Parameters<typeof console.error>))
    })
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  it("renders the auth gate with the provided props", async () => {
    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(React.createElement(PreAuthNavigator, baseProps))
    })

    const authGate = tree!.root.findByProps({ apiUrl: "https://api.example.com" })
    expect(authGate.props.onLogin).toBe(baseProps.onLogin)
    expect(authGate.props.status).toBe("Ready")
  })
})
