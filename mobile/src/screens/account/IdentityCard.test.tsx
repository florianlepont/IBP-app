import React from "react"
import renderer, { act } from "react-test-renderer"
import { ActionSheetIOS, Alert, Platform } from "react-native"
import type { AuthUser } from "../../app/types"
import { fr } from "../../i18n"
import { IdentityCard, resolveInitials, resolveProfilePictureUri } from "./IdentityCard"

const originalConsoleError = console.error

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const message = String(args[0] ?? "")
    if (message.includes("react-test-renderer is deprecated")) return
    originalConsoleError(...(args as Parameters<typeof console.error>))
  })
})

afterAll(() => {
  jest.restoreAllMocks()
})

jest.mock("react-native", () => {
  const mockComponent = (name: string) => {
    const ReactRef = jest.requireActual("react") as typeof import("react")
    return ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactRef.createElement(name, props, children)
  }
  return {
    Text: mockComponent("Text"),
    View: mockComponent("View"),
    Image: mockComponent("Image"),
    Pressable: mockComponent("Pressable"),
    Platform: { OS: "ios" },
    Alert: { alert: jest.fn() },
    ActionSheetIOS: { showActionSheetWithOptions: jest.fn() },
    StyleSheet: { create: <T extends object>(value: T): T => value },
  }
})

jest.mock("../../ui/AppCard", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  return {
    AppCard: ({ children }: { children?: React.ReactNode }) =>
      ReactRef.createElement("AppCard", null, children),
  }
})

jest.mock("../../ui/AppStatusChip", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  return {
    AppStatusChip: (props: { label: string }) => ReactRef.createElement("AppStatusChip", props),
  }
})

const user: AuthUser = {
  id: "user-1",
  email: "marie@example.org",
  display_name: "Marie",
  role: "",
  first_name: "Marie",
  last_name: "Curie",
  profile_picture_url: null,
}

const renderCard = async (overrides: Partial<React.ComponentProps<typeof IdentityCard>> = {}) => {
  const handlers = {
    onPickProfilePictureFromLibrary: jest.fn(async () => undefined),
    onTakeProfilePictureFromCamera: jest.fn(async () => undefined),
    onRemoveProfilePicture: jest.fn(async () => undefined),
  }
  let component: renderer.ReactTestRenderer
  await act(async () => {
    component = renderer.create(
      React.createElement(IdentityCard, {
        accessToken: "t",
        apiUrl: "http://localhost:3000/v1/",
        currentUser: user,
        profile: "",
        heroName: "Marie Curie",
        profileUpdating: false,
        ...handlers,
        ...overrides,
      }),
    )
  })
  return { root: component!.root, handlers }
}

const setPlatform = (os: "ios" | "android") => {
  ;(Platform as { OS: string }).OS = os
}

describe("IdentityCard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setPlatform("ios")
  })

  it("requests the profile picture with the access token as a Bearer header", async () => {
    const { root } = await renderCard({
      currentUser: { ...user, profile_picture_url: "/users/me/picture" },
    })

    const image = root.findByType("Image" as never)
    expect(image.props.source).toEqual({
      uri: "http://localhost:3000/v1/users/me/picture",
      headers: { Authorization: "Bearer t" },
    })
  })

  it("sends no header when there is no token", async () => {
    const { root } = await renderCard({
      accessToken: "",
      currentUser: { ...user, profile_picture_url: "https://cdn.example.org/p.jpg" },
    })

    expect(root.findByType("Image" as never).props.source).toEqual({
      uri: "https://cdn.example.org/p.jpg",
      headers: undefined,
    })
  })

  it("renders initials, the e-mail and the default role without a picture", async () => {
    const { root } = await renderCard()

    expect(root.findAllByType("Image" as never)).toHaveLength(0)
    const texts = root.findAllByType("Text" as never).map((node) => node.props.children)
    expect(texts).toEqual(["MC", "Marie Curie", "marie@example.org"])
    expect(root.findByType("AppStatusChip" as never).props.label).toBe(fr.account.defaultRole)
  })

  it("gives the camera badge a button role and catalogue labels", async () => {
    const { root } = await renderCard()

    const badge = root.findByType("Pressable" as never)
    expect(badge.props.accessibilityRole).toBe("button")
    expect(badge.props.accessibilityLabel).toBe(fr.account.a11y.editPhoto)
    expect(badge.props.accessibilityHint).toBe(fr.account.a11y.editPhotoHint)
  })

  it("opens the iOS action sheet with catalogue options and runs the chosen action", async () => {
    const { root, handlers } = await renderCard({
      currentUser: { ...user, profile_picture_url: "/p.jpg" },
    })

    act(() => {
      root.findByType("Pressable" as never).props.onPress()
    })

    const show = ActionSheetIOS.showActionSheetWithOptions as jest.Mock
    const [options, callback] = show.mock.calls[0] as [
      { title: string; options: string[]; destructiveButtonIndex?: number },
      (index: number) => void,
    ]
    const photo = fr.account.alerts.photo
    expect(options.title).toBe(photo.title)
    expect(options.options).toEqual([
      fr.common.actions.cancel,
      photo.take,
      photo.pick,
      photo.remove,
    ])
    expect(options.destructiveButtonIndex).toBe(3)

    callback(0)
    callback(1)
    callback(2)
    callback(3)
    expect(handlers.onTakeProfilePictureFromCamera).toHaveBeenCalledTimes(1)
    expect(handlers.onPickProfilePictureFromLibrary).toHaveBeenCalledTimes(1)
    expect(handlers.onRemoveProfilePicture).toHaveBeenCalledTimes(1)
  })

  it("falls back to an alert on Android with catalogue texts", async () => {
    setPlatform("android")
    const { root, handlers } = await renderCard()

    act(() => {
      root.findByType("Pressable" as never).props.onPress()
    })

    const [title, message, buttons] = (Alert.alert as jest.Mock).mock.calls[0] as [
      string,
      string | undefined,
      { text: string; onPress?: () => void }[],
    ]
    const photo = fr.account.alerts.photo
    expect(title).toBe(photo.title)
    expect(message).toBeUndefined()
    expect(buttons.map((button) => button.text)).toEqual([
      photo.take,
      photo.pick,
      fr.common.actions.cancel,
    ])
    buttons.forEach((button) => button.onPress?.())
    expect(handlers.onTakeProfilePictureFromCamera).toHaveBeenCalledTimes(1)
    expect(handlers.onPickProfilePictureFromLibrary).toHaveBeenCalledTimes(1)
  })

  it("offers removal in the Android alert when a picture exists", async () => {
    setPlatform("android")
    const { root, handlers } = await renderCard({
      currentUser: { ...user, profile_picture_url: "/p.jpg" },
    })

    act(() => {
      root.findByType("Pressable" as never).props.onPress()
    })

    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as {
      text: string
      onPress?: () => void
    }[]
    const remove = buttons.find((button) => button.text === fr.account.alerts.photo.remove)
    remove?.onPress?.()
    expect(handlers.onRemoveProfilePicture).toHaveBeenCalledTimes(1)
  })
})

describe("account helpers", () => {
  it("builds initials from the best available name", () => {
    expect(resolveInitials(null, "")).toBe(fr.account.fallbackName[0])
    expect(resolveInitials(null, "jean.dupont")).toBe("JD")
  })

  it("resolves relative and absolute picture paths", () => {
    expect(resolveProfilePictureUri(null, "http://api")).toBeNull()
    expect(resolveProfilePictureUri("p.jpg", "http://api//")).toBe("http://api/p.jpg")
  })
})
