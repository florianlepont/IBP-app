/**
 * Tests for useSurveySyncProfile.
 *
 * Strategy: render the real hook with renderHook from
 * @testing-library/react-native/pure (see render-hook-smoke.test.ts); each
 * callback runs inside act().
 */

const mockPatchMyProfile = jest.fn()
const mockChangeMyEmail = jest.fn()
const mockDeleteMyProfilePicture = jest.fn()
const mockRequestPasswordReset = jest.fn()
const mockUploadMyProfilePicture = jest.fn()

jest.mock("../../api/ibp-api", () => ({
  patchMyProfile: mockPatchMyProfile,
  changeMyEmail: mockChangeMyEmail,
  deleteMyProfilePicture: mockDeleteMyProfilePicture,
  requestPasswordReset: mockRequestPasswordReset,
  uploadMyProfilePicture: mockUploadMyProfilePicture,
}))

jest.mock("../useAuth0Session", () => ({
  AUTH_REQUIRED_ERROR: "AUTH_REQUIRED",
}))

jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
}))

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}))

import { act, cleanup, renderHook } from "@testing-library/react-native/pure"
import { Alert } from "react-native"
import * as ImagePicker from "expo-image-picker"
import { useSurveySyncProfile } from "./useSurveySyncProfile"

const AUTH_USER = {
  id: "user-1",
  auth0_sub: "auth0|user-1",
  email: "user@example.com",
  role: "contributor" as const,
  first_name: "User",
  last_name: "Example",
  display_name: "User Example",
  profile_picture_url: null,
}

/**
 * Wraps each callback of the rendered hook in act() so the state updates it
 * makes (profileUpdating) flush before the assertions run.
 */
function withAct<T extends object>(hook: T): T {
  const wrapped: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(hook)) {
    wrapped[key] =
      typeof value === "function"
        ? (...args: unknown[]) => act(() => (value as (...a: unknown[]) => unknown)(...args))
        : value
  }
  return wrapped as T
}

async function buildHook(overrides: Record<string, unknown> = {}) {
  const params = {
    apiUrl: "http://localhost:3000",
    currentUser: AUTH_USER,
    setProfileFromUser: jest.fn(),
    clearSession: jest.fn().mockResolvedValue(undefined),
    withAuthRetry: jest.fn((fn: (token: string) => unknown) => fn("token")),
    handleLoadMyProfile: jest.fn().mockResolvedValue(AUTH_USER),
    setStatus: jest.fn(),
    ...overrides,
  }
  const { result } = await renderHook(() => useSurveySyncProfile(params as never))
  return { ...withAct(result.current), ...params }
}

describe("useSurveySyncProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await cleanup()
  })

  // ─── handleUpdateProfile ───────────────────────────────────────────────────

  describe("handleUpdateProfile", () => {
    test("calls patchMyProfile and updates status on success", async () => {
      mockPatchMyProfile.mockResolvedValue({ ...AUTH_USER, display_name: "New Name" })
      const { handleUpdateProfile, setStatus, setProfileFromUser } = await buildHook()

      await handleUpdateProfile({
        first_name: "User",
        last_name: "Example",
        display_name: "New Name",
      })

      expect(setStatus).toHaveBeenCalledWith("Profile updated")
      expect(setProfileFromUser).toHaveBeenCalledWith(
        expect.objectContaining({ display_name: "New Name" }),
      )
    })

    test("rejects blank display_name without calling API", async () => {
      const { handleUpdateProfile, setStatus } = await buildHook()

      await handleUpdateProfile({ first_name: "User", last_name: "Example", display_name: "   " })

      expect(setStatus).toHaveBeenCalledWith("Display name is required")
      expect(mockPatchMyProfile).not.toHaveBeenCalled()
    })

    test("calls clearSession on AUTH_REQUIRED error", async () => {
      const { handleUpdateProfile, clearSession } = await buildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_REQUIRED")),
      })

      await handleUpdateProfile({ first_name: "U", last_name: "E", display_name: "Name" })

      expect(clearSession).toHaveBeenCalled()
    })

    test("sets error status on generic error", async () => {
      const { handleUpdateProfile, setStatus } = await buildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("Server error")),
      })

      await handleUpdateProfile({ first_name: "U", last_name: "E", display_name: "Name" })

      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Server error"))
    })

    test("trims whitespace from profile fields", async () => {
      mockPatchMyProfile.mockResolvedValue(AUTH_USER)
      const { handleUpdateProfile } = await buildHook()

      await handleUpdateProfile({
        first_name: "  User  ",
        last_name: "  Ex  ",
        display_name: "  Name  ",
      })

      expect(mockPatchMyProfile).toHaveBeenCalledWith(
        "http://localhost:3000",
        "token",
        expect.objectContaining({ first_name: "User", last_name: "Ex", display_name: "Name" }),
      )
    })
  })

  // ─── handleChangeEmail ────────────────────────────────────────────────────

  describe("handleChangeEmail", () => {
    test("calls changeMyEmail and updates profile + status", async () => {
      mockChangeMyEmail.mockResolvedValue(undefined)
      const { handleChangeEmail, setStatus, setProfileFromUser } = await buildHook()

      await handleChangeEmail("new@example.com")

      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Email updated"))
      expect(setProfileFromUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: "new@example.com" }),
      )
    })

    test("calls clearSession on AUTH_REQUIRED", async () => {
      const { handleChangeEmail, clearSession } = await buildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_REQUIRED")),
      })

      await handleChangeEmail("new@example.com")

      expect(clearSession).toHaveBeenCalled()
    })

    test("sets error status and shows alert on failure", async () => {
      const { handleChangeEmail, setStatus } = await buildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("Email already taken")),
      })

      await handleChangeEmail("taken@example.com")

      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Email change error"))
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Email already taken", expect.any(Array))
    })
  })

  // ─── handlePasswordReset ──────────────────────────────────────────────────

  describe("handlePasswordReset", () => {
    test("calls requestPasswordReset, sets status and shows success alert", async () => {
      mockRequestPasswordReset.mockResolvedValue(undefined)
      const { handlePasswordReset, setStatus } = await buildHook()

      await handlePasswordReset()

      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Password reset"))
      expect(Alert.alert).toHaveBeenCalledWith(
        "Password reset",
        expect.stringContaining(AUTH_USER.email),
        expect.any(Array),
      )
    })

    test("calls clearSession on AUTH_REQUIRED", async () => {
      const { handlePasswordReset, clearSession } = await buildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_REQUIRED")),
      })

      await handlePasswordReset()

      expect(clearSession).toHaveBeenCalled()
    })

    test("shows error alert on generic failure", async () => {
      const { handlePasswordReset } = await buildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("SMTP error")),
      })

      await handlePasswordReset()

      expect(Alert.alert).toHaveBeenCalledWith(
        "Error",
        expect.stringContaining("SMTP error"),
        expect.any(Array),
      )
    })
  })

  // ─── handlePickProfilePictureFromLibrary ──────────────────────────────────

  describe("handlePickProfilePictureFromLibrary", () => {
    test("sets status when media library permission is denied", async () => {
      ;(ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: false,
      })
      const { handlePickProfilePictureFromLibrary, setStatus } = await buildHook()

      await handlePickProfilePictureFromLibrary()

      expect(setStatus).toHaveBeenCalledWith("Media library permission is required")
    })

    test("sets status when picker is cancelled", async () => {
      ;(ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
      })
      ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true })
      const { handlePickProfilePictureFromLibrary, setStatus } = await buildHook()

      await handlePickProfilePictureFromLibrary()

      expect(setStatus).toHaveBeenCalledWith("No image selected")
    })
  })

  // ─── handleTakeProfilePictureFromCamera ───────────────────────────────────

  describe("handleTakeProfilePictureFromCamera", () => {
    test("sets status when camera permission is denied", async () => {
      ;(ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: false,
      })
      const { handleTakeProfilePictureFromCamera, setStatus } = await buildHook()

      await handleTakeProfilePictureFromCamera()

      expect(setStatus).toHaveBeenCalledWith("Camera permission is required")
    })

    test("sets status when camera is cancelled", async () => {
      ;(ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true })
      ;(ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true })
      const { handleTakeProfilePictureFromCamera, setStatus } = await buildHook()

      await handleTakeProfilePictureFromCamera()

      expect(setStatus).toHaveBeenCalledWith("No photo captured")
    })
  })

  // ─── handleRemoveProfilePicture ───────────────────────────────────────────

  describe("handleRemoveProfilePicture", () => {
    test("calls deleteMyProfilePicture and patchMyProfile on success", async () => {
      mockDeleteMyProfilePicture.mockResolvedValue(undefined)
      mockPatchMyProfile.mockResolvedValue({ ...AUTH_USER, profile_picture_url: null })
      const { handleRemoveProfilePicture, setStatus } = await buildHook()

      await handleRemoveProfilePicture()

      expect(mockDeleteMyProfilePicture).toHaveBeenCalled()
      expect(mockPatchMyProfile).toHaveBeenCalledWith(
        "http://localhost:3000",
        "token",
        expect.objectContaining({ profile_picture_url: null }),
      )
      expect(setStatus).toHaveBeenCalledWith("Profile picture removed")
    })

    test("calls clearSession on AUTH_REQUIRED", async () => {
      const { handleRemoveProfilePicture, clearSession } = await buildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_REQUIRED")),
      })

      await handleRemoveProfilePicture()

      expect(clearSession).toHaveBeenCalled()
    })

    test("loads profile when currentUser is null", async () => {
      mockDeleteMyProfilePicture.mockResolvedValue(undefined)
      mockPatchMyProfile.mockResolvedValue({ ...AUTH_USER, profile_picture_url: null })
      const handleLoadMyProfile = jest.fn().mockResolvedValue(AUTH_USER)
      const { handleRemoveProfilePicture } = await buildHook({
        currentUser: null,
        handleLoadMyProfile,
      })

      await handleRemoveProfilePicture()

      expect(handleLoadMyProfile).toHaveBeenCalledWith({ silent: true })
    })
  })
})
