import React, { ComponentProps } from "react"
import renderer, { act } from "react-test-renderer"
import { AuthUser } from "../app/types"

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
  const ReactRef = require("react") as typeof import("react")
  const mockComponent = (name: string) => {
    return ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactRef.createElement(name, props, children)
  }

  return {
    Button: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactRef.createElement("Button", props, children),
    Image: mockComponent("Image"),
    Text: mockComponent("Text"),
    TextInput: mockComponent("TextInput"),
    View: mockComponent("View"),
    StyleSheet: {
      create: <T extends object>(value: T): T => value,
    },
  }
})

import { ProfileScreen } from "./ProfileScreen"

const baseUser: AuthUser = {
  id: "u-1",
  email: "demo@ibp.local",
  role: "contributor",
  first_name: "Demo",
  last_name: "User",
  display_name: "Demo User",
  profile_picture_url: null,
}

const buildProps = (
  overrides?: Partial<ComponentProps<typeof ProfileScreen>>,
): ComponentProps<typeof ProfileScreen> => ({
  accessToken: "access-token",
  isAuthenticated: true,
  currentUser: baseUser,
  profile: "Demo User (demo@ibp.local)",
  profileUpdating: false,
  status: "Ready",
  apiUrl: "http://localhost:3000/v1",
  onApiUrlChange: jest.fn(),
  email: "demo@ibp.local",
  onEmailChange: jest.fn(),
  password: "demo123",
  onPasswordChange: jest.fn(),
  onLogin: jest.fn(async () => undefined),
  onLogout: jest.fn(async () => undefined),
  onSync: jest.fn(async () => undefined),
  onPullChanges: jest.fn(async () => undefined),
  onDebugResetIbpData: jest.fn(async () => undefined),
  onDebugResetUserData: jest.fn(async () => undefined),
  onRefreshLocalList: jest.fn(async () => undefined),
  onRefreshLocalAttachments: jest.fn(async () => undefined),
  onReloadProfile: jest.fn(async () => baseUser),
  onSaveProfile: jest.fn(async () => undefined),
  onPickProfilePictureFromLibrary: jest.fn(async () => undefined),
  onTakeProfilePictureFromCamera: jest.fn(async () => undefined),
  onRemoveProfilePicture: jest.fn(async () => undefined),
  onConfirmEmailChange: jest.fn(async () => undefined),
  ...overrides,
})

describe("ProfileScreen", () => {
  it("submits manually entered email confirmation token", async () => {
    const onConfirmEmailChange = jest.fn(async () => undefined)
    const userWithPendingEmail: AuthUser = {
      ...baseUser,
      email_change_required: true,
      email_change_pending_to: "new@ibp.local",
    }

    let component: renderer.ReactTestRenderer
    await act(async () => {
      component = renderer.create(
        React.createElement(ProfileScreen, {
          ...buildProps({
            currentUser: userWithPendingEmail,
            onConfirmEmailChange,
          }),
        }),
      )
    })

    const tokenInput = component!.root.findByProps({ placeholder: "Paste confirmation token" })
    await act(async () => {
      tokenInput.props.onChangeText("token-from-email")
    })

    const confirmButton = component!.root.findByProps({ title: "Confirm pending email" })
    await act(async () => {
      confirmButton.props.onPress()
    })

    expect(onConfirmEmailChange).toHaveBeenCalledWith("token-from-email")
  })

  it("prefills dev token when available", async () => {
    const onConfirmEmailChange = jest.fn(async () => undefined)
    const userWithDevToken: AuthUser = {
      ...baseUser,
      email_change_required: true,
      email_change_pending_to: "new@ibp.local",
      email_change_token_dev: "dev-token",
    }

    let component: renderer.ReactTestRenderer
    await act(async () => {
      component = renderer.create(
        React.createElement(ProfileScreen, {
          ...buildProps({
            currentUser: userWithDevToken,
            onConfirmEmailChange,
          }),
        }),
      )
    })

    const confirmButton = component!.root.findByProps({ title: "Confirm pending email" })
    await act(async () => {
      confirmButton.props.onPress()
    })

    expect(onConfirmEmailChange).toHaveBeenCalledWith("dev-token")
  })
})
