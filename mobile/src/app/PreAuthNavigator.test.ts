import React from "react"
import renderer, { act } from "react-test-renderer"

const mockNavigate = jest.fn()
const originalConsoleError = console.error

jest.mock("@react-navigation/native", () => {
  const ReactRef = require("react") as typeof import("react")
  return {
    NavigationContainer: ReactRef.forwardRef(
      (
        { children }: { children?: React.ReactNode },
        ref: React.Ref<{ navigate: typeof mockNavigate }>,
      ) => {
        if (typeof ref === "function") {
          ref({ navigate: mockNavigate })
        } else if (ref && "current" in ref) {
          ;(ref as { current: { navigate: typeof mockNavigate } | null }).current = {
            navigate: mockNavigate,
          }
        }
        return ReactRef.createElement("NavigationContainer", {}, children)
      },
    ),
  }
})

jest.mock("@react-navigation/native-stack", () => {
  const ReactRef = require("react") as typeof import("react")
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: { children?: React.ReactNode }) =>
        ReactRef.createElement("Navigator", {}, children),
      Screen: ({
        name,
        children,
      }: {
        name: string
        children?: ((input: { route: { params: { email: string; devToken?: string } } }) => unknown) | React.ReactNode
      }) => {
        const content =
          typeof children === "function"
            ? children({
                route: {
                  params: {
                    email: "pending@example.com",
                    devToken: "seed-token",
                  },
                },
              })
            : children
        return ReactRef.createElement(name, { screenName: name }, content as React.ReactNode)
      },
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

jest.mock("../screens/EmailVerificationScreen", () => {
  const ReactRef = require("react") as typeof import("react")
  return {
    EmailVerificationScreen: (props: Record<string, unknown>) =>
      ReactRef.createElement("EmailVerificationScreen", props),
  }
})

import { PreAuthNavigator } from "./PreAuthNavigator"

describe("PreAuthNavigator", () => {
  const baseProps = {
    apiUrl: "https://api.example.com",
    onApiUrlChange: jest.fn(),
    email: "user@example.com",
    onEmailChange: jest.fn(),
    password: "Secret123!",
    onPasswordChange: jest.fn(),
    displayName: "Algernon",
    onDisplayNameChange: jest.fn(),
    onLogin: jest.fn(async () => undefined),
    onRegister: jest.fn(async () => undefined),
    status: "Ready",
    pendingEmailVerification: null as string | null,
    devVerificationToken: null as string | null,
    onVerifyEmail: jest.fn(async () => undefined),
    onResendVerification: jest.fn(async () => undefined),
    onCancelEmailVerification: jest.fn(async () => undefined),
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

  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it("renders the auth gate with the provided props", async () => {
    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(React.createElement(PreAuthNavigator, baseProps))
    })

    const authGate = tree!.root.findByProps({ apiUrl: "https://api.example.com" })
    expect(authGate.props.email).toBe("user@example.com")
    expect(authGate.props.displayName).toBe("Algernon")
  })

  it("navigates to email verification when a pending email is present", async () => {
    await act(async () => {
      renderer.create(
        React.createElement(PreAuthNavigator, {
          ...baseProps,
          pendingEmailVerification: "pending@example.com",
          devVerificationToken: "verify-token",
        }),
      )
    })

    expect(mockNavigate).toHaveBeenCalledWith("EmailVerification", {
      email: "pending@example.com",
      devToken: "verify-token",
    })
  })

  it("returns to the auth gate when the pending email is cleared", async () => {
    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(
        React.createElement(PreAuthNavigator, {
          ...baseProps,
          pendingEmailVerification: "pending@example.com",
        }),
      )
    })

    mockNavigate.mockClear()

    await act(async () => {
      tree!.update(React.createElement(PreAuthNavigator, baseProps))
    })

    expect(mockNavigate).toHaveBeenCalledWith("AuthGate", undefined)
  })
})
