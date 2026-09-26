import { Alert } from "react-native"
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
import { fr, logStatusDetail, type StatusMessage } from "../../i18n"
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
  setStatus: (message: StatusMessage) => void
}

const text = fr.status.profile

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
        setStatus(text.displayNameRequired())
        return
      }

      try {
        setProfileUpdating(true)
        const user = await withAuthRetry((token) => patchMyProfile(apiUrl, token, payload))

        setProfileFromUser(user)
        setStatus(text.updated())
      } catch (error) {
        if ((error as Error).message === AUTH_REQUIRED_ERROR) {
          await clearSession()
          setStatus(text.updateLoginRequired())
          return
        }
        logStatusDetail("profile.update", error)
        setStatus(text.updateFailed())
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
        setStatus(text.pictureUploading())
        const uploadResponse = await withAuthRetry(async (token) => {
          const body = await uploadMyProfilePicture(apiUrl, token, payload)
          if (!body.profile_picture_url) {
            throw new Error(body.message ?? "Profile picture URL missing after upload")
          }
          return body.profile_picture_url
        })

        const baseUser = currentUser ?? (await handleLoadMyProfile({ silent: true }))
        if (!baseUser) {
          setStatus(text.pictureUploadedRefreshNeedsLogin())
          return
        }

        await handleUpdateProfile({
          first_name: baseUser.first_name,
          last_name: baseUser.last_name,
          display_name: baseUser.display_name,
          profile_picture_url: uploadResponse,
        })
        setStatus(text.pictureUploaded())
      } catch (error) {
        if ((error as Error).message === AUTH_REQUIRED_ERROR) {
          await clearSession()
          setStatus(text.pictureUploadLoginRequired())
          return
        }
        logStatusDetail("profile.pictureUpload", error)
        setStatus(text.pictureUploadFailed())
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
        setStatus(text.mediaLibraryPermissionRequired())
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      })
      if (result.canceled || !result.assets?.[0]) {
        setStatus(text.noImageSelected())
        return
      }

      await uploadProfilePictureFromAsset(result.assets[0])
    } catch (error) {
      logStatusDetail("profile.pictureLibrary", error)
      setStatus(text.pictureLibraryFailed())
    }
  }, [setStatus, uploadProfilePictureFromAsset])

  const handleTakeProfilePictureFromCamera = useCallback(async (): Promise<void> => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        setStatus(text.cameraPermissionRequired())
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      })
      if (result.canceled || !result.assets?.[0]) {
        setStatus(text.noPhotoCaptured())
        return
      }

      await uploadProfilePictureFromAsset(result.assets[0])
    } catch (error) {
      logStatusDetail("profile.pictureCamera", error)
      setStatus(text.pictureCameraFailed())
    }
  }, [setStatus, uploadProfilePictureFromAsset])

  const handleRemoveProfilePicture = useCallback(async (): Promise<void> => {
    const baseUser = currentUser ?? (await handleLoadMyProfile({ silent: true }))
    if (!baseUser) {
      setStatus(text.pictureRemoveLoginRequired())
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
      setStatus(text.pictureRemoved())
    } catch (error) {
      if ((error as Error).message === AUTH_REQUIRED_ERROR) {
        await clearSession()
        setStatus(text.pictureRemoveLoginRequired())
        return
      }
      logStatusDetail("profile.pictureRemove", error)
      setStatus(text.pictureRemoveFailed())
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
        if (currentUser) {
          setProfileFromUser({ ...currentUser, email: newEmail })
        }
        setStatus(text.emailUpdated())
      } catch (error) {
        if ((error as Error).message === AUTH_REQUIRED_ERROR) {
          await clearSession()
          setStatus(text.loginRequired())
          return
        }
        logStatusDetail("profile.changeEmail", error)
        setStatus(text.emailChangeFailed())
        Alert.alert(text.alerts.errorTitle, text.alerts.emailChangeFailed, [
          { text: fr.common.actions.ok },
        ])
      } finally {
        setProfileUpdating(false)
      }
    },
    [apiUrl, clearSession, currentUser, setProfileFromUser, setStatus, withAuthRetry],
  )

  const handlePasswordReset = useCallback(async (): Promise<void> => {
    try {
      setProfileUpdating(true)
      await withAuthRetry((token) => requestPasswordReset(apiUrl, token))
      setStatus(text.passwordResetSent())
      Alert.alert(
        text.alerts.passwordResetTitle,
        text.alerts.passwordResetSent({
          email: currentUser?.email ?? text.alerts.yourEmailAddress,
        }),
        [{ text: fr.common.actions.ok }],
      )
    } catch (error) {
      if ((error as Error).message === AUTH_REQUIRED_ERROR) {
        await clearSession()
        setStatus(text.loginRequired())
        return
      }
      logStatusDetail("profile.passwordReset", error)
      setStatus(text.passwordResetFailed())
      Alert.alert(text.alerts.errorTitle, text.alerts.passwordResetFailed, [
        { text: fr.common.actions.ok },
      ])
    } finally {
      setProfileUpdating(false)
    }
  }, [apiUrl, clearSession, currentUser, setStatus, withAuthRetry])

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
