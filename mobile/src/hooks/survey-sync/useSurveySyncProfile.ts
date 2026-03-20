import { useCallback, useState } from "react"
import * as ImagePicker from "expo-image-picker"
import {
  confirmMyEmail,
  deleteMyProfilePicture,
  patchMyProfile,
  uploadMyProfilePicture,
} from "../../api/ibp-api"
import { AuthUser } from "../../app/types"
import { AUTH_REQUIRED_ERROR } from "../useAuthSession"
import { guessMimeType } from "./utils"

export type UpdateProfileInput = {
  first_name: string
  last_name: string
  display_name: string
  email: string
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
        email: input.email.trim().toLowerCase(),
        ...(Object.prototype.hasOwnProperty.call(input, "profile_picture_url")
          ? { profile_picture_url: input.profile_picture_url ?? null }
          : {}),
      }

      if (!payload.display_name) {
        setStatus("Display name is required")
        return
      }
      if (!payload.email || !payload.email.includes("@")) {
        setStatus("A valid email is required")
        return
      }

      try {
        setProfileUpdating(true)
        const user = await withAuthRetry((token) => patchMyProfile(apiUrl, token, payload))

        setProfileFromUser(user)
        if (user.email_change_required) {
          setStatus(
            `Profile updated. Email confirmation required for ${user.email_change_pending_to ?? "pending email"}`,
          )
        } else {
          setStatus("Profile updated")
        }
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

  const handleConfirmEmailChange = useCallback(
    async (token: string): Promise<void> => {
      if (!token.trim()) {
        setStatus("Email confirmation token is required")
        return
      }

      try {
        setProfileUpdating(true)
        const user = await withAuthRetry((access) => confirmMyEmail(apiUrl, access, token.trim()))

        setProfileFromUser(user)
        setStatus("Email address confirmed")
      } catch (error) {
        if ((error as Error).message === AUTH_REQUIRED_ERROR) {
          await clearSession()
          setStatus("Login required before confirming email")
          return
        }
        setStatus(`Email confirmation error: ${(error as Error).message}`)
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
      payload.append("file", {
        uri: asset.uri,
        type: mimeType,
        name: asset.fileName ?? `profile-${Date.now()}`,
      } as any)

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
          email: baseUser.email,
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
        email: baseUser.email,
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

  return {
    profileUpdating,
    handleUpdateProfile,
    handleConfirmEmailChange,
    handlePickProfilePictureFromLibrary,
    handleTakeProfilePictureFromCamera,
    handleRemoveProfilePicture,
  }
}
