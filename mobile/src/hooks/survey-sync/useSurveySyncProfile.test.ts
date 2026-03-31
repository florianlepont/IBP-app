/**
 * Tests for useSurveySyncProfile.
 *
 * Strategy: spy on React.useState / useCallback so the hook can be called
 * directly in Node without a renderer.
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

import React from "react"
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

function buildHook(overrides: Record<string, unknown> = {}) {
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
  const hook = useSurveySyncProfile(params as never)
  return { ...hook, ...params }
}

describe("useSurveySyncProfile", () => {
  let useStateSpy: jest.SpyInstance
  let useCallbackSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    useStateSpy = jest
      .spyOn(React, "useState")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(((initial: unknown) => [initial, jest.fn()]) as any)
    useCallbackSpy = jest
      .spyOn(React, "useCallback")
      .mockImplementation((fn) => fn as never)
  })

  afterEach(() => {
    useStateSpy.mockRestore()
    useCallbackSpy.mockRestore()
  })

  // ─── handleUpdateProfile ───────────────────────────────────────────────────

  describe("handleUpdateProfile", () => {
    test("calls patchMyProfile and updates status on success", async () => {
      mockPatchMyProfile.mockResolvedValue({ ...AUTH_USER, display_name: "New Name" })
      const { handleUpdateProfile, setStatus, setProfileFromUser } = buildHook()

      await handleUpdateProfile({ first_name: "User", last_name: "Example", display_name: "New Name" })

      expect(setStatus).toHaveBeenCalledWith("Profile updated")
      expect(setProfileFromUser).toHaveBeenCalledWith(expect.objectContaining({ display_name: "New Name" }))
    })

    test("rejects blank display_name without calling API", async () => {
      const { handleUpdateProfile, setStatus } = buildHook()

      await handleUpdateProfile({ first_name: "User", last_name: "Example", display_name: "   " })

      expect(setStatus).toHaveBeenCalledWith("Display name is required")
      expect(mockPatchMyProfile).not.toHaveBeenCalled()
    })

    test("calls clearSession on AUTH_REQUIRED error", async () => {
      const { handleUpdateProfile, clearSession } = buildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_REQUIRED")),
      })

      await handleUpdateProfile({ first_name: "U", last_name: "E", display_name: "Name" })

      expect(clearSession).toHaveBeenCalled()
    })

    test("sets error status on generic error", async () => {
      const { handleUpdateProfile, setStatus } = buildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("Server error")),
      })

      await handleUpdateProfile({ first_name: "U", last_name: "E", display_name: "Name" })

      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Server error"))
    })

    test("trims whitespace from profile fields", async () => {
      mockPatchMyProfile.mockResolvedValue(AUTH_USER)
      const { handleUpdateProfile } = buildHook()

      await handleUpdateProfile({ first_name: "  User  ", last_name: "  Ex  ", display_name: "  Name  " })

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
      const { handleChangeEmail, setStatus, setProfileFromUser } = buildHook()

      await handleChangeEmail("new@example.com")

      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Email updated"))
      expect(setProfileFromUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: "new@example.com" }),
      )
    })

    test("calls clearSession on AUTH_REQUIRED", async () => {
      const { handleChangeEmail, clearSession } = buildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_REQUIRED")),
      })

      await handleChangeEmail("new@example.com")

      expect(clearSession).toHaveBeenCalled()
    })

    test("sets error status and shows alert on failure", async () => {
      const { handleChangeEmail, setStatus } = buildHook({
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
      const { handlePasswordReset, setStatus } = buildHook()

      await handlePasswordReset()

      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Password reset"))
      expect(Alert.alert).toHaveBeenCalledWith(
        "Password reset",
        expect.stringContaining(AUTH_USER.email),
        expect.any(Array),
      )
    })

    test("calls clearSession on AUTH_REQUIRED", async () => {
      const { handlePasswordReset, clearSession } = buildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_REQUIRED")),
      })

      await handlePasswordReset()

      expect(clearSession).toHaveBeenCalled()
    })

    test("shows error alert on generic failure", async () => {
      const { handlePasswordReset } = buildHook({
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
      const { handlePickProfilePictureFromLibrary, setStatus } = buildHook()

      await handlePickProfilePictureFromLibrary()

      expect(setStatus).toHaveBeenCalledWith("Media library permission is required")
    })

    test("sets status when picker is cancelled", async () => {
      ;(ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
      })
      ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true })
      const { handlePickProfilePictureFromLibrary, setStatus } = buildHook()

      await handlePickProfilePictureFromLibrary()

      expect(setStatus).toHaveBeenCalledWith("No image selected")
    })
  })

  // ─── handleTakeProfilePictureFromCamera ───────────────────────────────────

  describe("handleTakeProfilePictureFromCamera", () => {
    test("sets status when camera permission is denied", async () => {
      ;(ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false })
      const { handleTakeProfilePictureFromCamera, setStatus } = buildHook()

      await handleTakeProfilePictureFromCamera()

      expect(setStatus).toHaveBeenCalledWith("Camera permission is required")
    })

    test("sets status when camera is cancelled", async () => {
      ;(ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true })
      ;(ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true })
      const { handleTakeProfilePictureFromCamera, setStatus } = buildHook()

      await handleTakeProfilePictureFromCamera()

      expect(setStatus).toHaveBeenCalledWith("No photo captured")
    })
  })

  // ─── handleRemoveProfilePicture ───────────────────────────────────────────

  describe("handleRemoveProfilePicture", () => {
    test("calls deleteMyProfilePicture and patchMyProfile on success", async () => {
      mockDeleteMyProfilePicture.mockResolvedValue(undefined)
      mockPatchMyProfile.mockResolvedValue({ ...AUTH_USER, profile_picture_url: null })
      const { handleRemoveProfilePicture, setStatus } = buildHook()

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
      const { handleRemoveProfilePicture, clearSession } = buildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_REQUIRED")),
      })

      await handleRemoveProfilePicture()

      expect(clearSession).toHaveBeenCalled()
    })

    test("loads profile when currentUser is null", async () => {
      mockDeleteMyProfilePicture.mockResolvedValue(undefined)
      mockPatchMyProfile.mockResolvedValue({ ...AUTH_USER, profile_picture_url: null })
      const handleLoadMyProfile = jest.fn().mockResolvedValue(AUTH_USER)
      const { handleRemoveProfilePicture } = buildHook({
        currentUser: null,
        handleLoadMyProfile,
      })

      await handleRemoveProfilePicture()

      expect(handleLoadMyProfile).toHaveBeenCalledWith({ silent: true })
    })
  })
})
