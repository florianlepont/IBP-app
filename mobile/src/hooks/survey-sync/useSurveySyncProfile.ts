import { useCallback, useState } from "react"
import * as ImagePicker from "expo-image-picker"
import {
  changeMyEmail,
  deleteMyProfilePicture,
  patchMyProfile,
  requestPasswordReset,
  uploadMyProfilePicture,
} from "../../api/ibp-api"
import { AuthUser } from "../../app/types"
import { AUTH_REQUIRED_ERROR } from "../useAuth0Session"
import { guessMimeType } from "./utils"

export type UpdateProfileInput = {
  first_name: string
  last_name: string
  display_name: string
  profile_picture_url?: string | null
}

type UseSurveySyncProfileParams = {
  apiUrl: string
  currentUser: AuthUser | null
  setProfileFromUser: (user: AuthUser) => void
  clearSession: () => Promise<void>
  withAuthRetry: <T>(fn: (token: string) => Promise<T>) => Promise<T>
  handleLoadMyProfile: (options?: { silent?: boolean }) => Promise<AuthUser | null>
  setStatus: (message: string) => void
}

type ReactNativeFormFile = Blob & {
  uri: string
  type: string
  name: string
}

export function useSurveySyncProfile({
  apiUrl,
  currentUser,
  setProfileFromUser,
  clearSession,
  withAuthRetry,
  handleLoadMyProfile,
  setStatus,
}: UseSurveySyncProfileParams) {
  const [profileUpdating, setProfileUpdating] = useState(false)

  const handleUpdateProfile = useCallback(
    async (input: UpdateProfileInput): Promise<void> => {
      const payload = {
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        display_name: input.display_name.trim(),
        ...(Object.prototype.hasOwnProperty.call(input, "profile_picture_url")
          ? { profile_picture_url: input.profile_picture_url ?? null }
          : {}),
      }

      if (!payload.display_name) {
        setStatus("Display name is required")
        return
      }

      try {
        setProfileUpdating(true)
        const user = await withAuthRetry((token) => patchMyProfile(apiUrl, token, payload))

        setProfileFromUser(user)
        setStatus("Profile updated")
      } catch (error) {
        if ((error as Error).message === AUTH_REQUIRED_ERROR) {
          await clearSession()
          setStatus("Login required before updating profile")
          return
        }
        setStatus(`Profile update error: ${(error as Error).message}`)
      } finally {
        setProfileUpdating(false)
      }
    },
    [apiUrl, clearSession, setProfileFromUser, setStatus, withAuthRetry],
  )

  const uploadProfilePictureFromAsset = useCallback(
    async (asset: ImagePicker.ImagePickerAsset): Promise<void> => {
      const mimeType = asset.mimeType ?? guessMimeType(asset.uri)
      const payload = new FormData()
      const file: ReactNativeFormFile = {
        uri: asset.uri,
        type: mimeType,
        name: asset.fileName ?? `profile-${Date.now()}`,
      } as unknown as ReactNativeFormFile
      payload.append("file", file)

      try {
        setProfileUpdating(true)
        setStatus("Uploading profile picture...")
        const uploadResponse = await withAuthRetry(async (token) => {
          const body = await uploadMyProfilePicture(apiUrl, token, payload)
          if (!body.profile_picture_url) {
            throw new Error(body.message ?? "Profile picture URL missing after upload")
          }
          return body.profile_picture_url
        })

        const baseUser = currentUser ?? (await handleLoadMyProfile({ silent: true }))
        if (!baseUser) {
          setStatus("Profile picture uploaded, but profile refresh requires login")
          return
        }

        await handleUpdateProfile({
          first_name: baseUser.first_name,
          last_name: baseUser.last_name,
          display_name: baseUser.display_name,
          profile_picture_url: uploadResponse,
        })
        setStatus("Profile picture uploaded")
      } catch (error) {
        if ((error as Error).message === AUTH_REQUIRED_ERROR) {
          await clearSession()
          setStatus("Login required before uploading profile picture")
          return
        }
        setStatus(`Profile picture upload error: ${(error as Error).message}`)
      } finally {
        setProfileUpdating(false)
      }
    },
    [
      apiUrl,
      clearSession,
      currentUser,
      handleLoadMyProfile,
      handleUpdateProfile,
      setStatus,
      withAuthRetry,
    ],
  )

  const handlePickProfilePictureFromLibrary = useCallback(async (): Promise<void> => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        setStatus("Media library permission is required")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      })
      if (result.canceled || !result.assets?.[0]) {
        setStatus("No image selected")
        return
      }

      await uploadProfilePictureFromAsset(result.assets[0])
    } catch (error) {
      setStatus(`Profile image picker error: ${(error as Error).message}`)
    }
  }, [setStatus, uploadProfilePictureFromAsset])

  const handleTakeProfilePictureFromCamera = useCallback(async (): Promise<void> => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        setStatus("Camera permission is required")
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      })
      if (result.canceled || !result.assets?.[0]) {
        setStatus("No photo captured")
        return
      }

      await uploadProfilePictureFromAsset(result.assets[0])
    } catch (error) {
      setStatus(`Profile camera error: ${(error as Error).message}`)
    }
  }, [setStatus, uploadProfilePictureFromAsset])

  const handleRemoveProfilePicture = useCallback(async (): Promise<void> => {
    const baseUser = currentUser ?? (await handleLoadMyProfile({ silent: true }))
    if (!baseUser) {
      setStatus("Login required before removing profile picture")
      return
    }

    try {
      setProfileUpdating(true)
      await withAuthRetry((token) => deleteMyProfilePicture(apiUrl, token))
      await handleUpdateProfile({
        first_name: baseUser.first_name,
        last_name: baseUser.last_name,
        display_name: baseUser.display_name,
        profile_picture_url: null,
      })
      setStatus("Profile picture removed")
    } catch (error) {
      if ((error as Error).message === AUTH_REQUIRED_ERROR) {
        await clearSession()
        setStatus("Login required before removing profile picture")
        return
      }
      setStatus(`Profile picture remove error: ${(error as Error).message}`)
    } finally {
      setProfileUpdating(false)
    }
  }, [
    apiUrl,
    clearSession,
    currentUser,
    handleLoadMyProfile,
    handleUpdateProfile,
    setStatus,
    withAuthRetry,
  ])

  const handleChangeEmail = useCallback(
    async (newEmail: string): Promise<void> => {
      try {
        setProfileUpdating(true)
        await withAuthRetry((token) => changeMyEmail(apiUrl, token, newEmail))
        await handleLoadMyProfile({ silent: true })
        setStatus("Email updated. Check your inbox to verify the new address.")
      } catch (error) {
        if ((error as Error).message === AUTH_REQUIRED_ERROR) {
          await clearSession()
          setStatus("Login required")
          return
        }
        setStatus(`Email change error: ${(error as Error).message}`)
      } finally {
        setProfileUpdating(false)
      }
    },
    [apiUrl, clearSession, handleLoadMyProfile, setStatus, withAuthRetry],
  )

  const handlePasswordReset = useCallback(async (): Promise<void> => {
    try {
      setProfileUpdating(true)
      await withAuthRetry((token) => requestPasswordReset(apiUrl, token))
      setStatus("Password reset email sent. Check your inbox.")
    } catch (error) {
      if ((error as Error).message === AUTH_REQUIRED_ERROR) {
        await clearSession()
        setStatus("Login required")
        return
      }
      setStatus(`Error: ${(error as Error).message}`)
    } finally {
      setProfileUpdating(false)
    }
  }, [apiUrl, clearSession, setStatus, withAuthRetry])

  return {
    profileUpdating,
    handleUpdateProfile,
    handleChangeEmail,
    handlePasswordReset,
    handlePickProfilePictureFromLibrary,
    handleTakeProfilePictureFromCamera,
    handleRemoveProfilePicture,
  }
}
