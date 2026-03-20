import { useEffect, useState } from "react"
import { loadStoredApiUrl, saveStoredApiUrl } from "../app/api-url-storage"
import { DEFAULT_API_URL } from "../app/constants"

export function useAuthenticationState() {
  const [apiUrl, setApiUrl] = useState(() => process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")

  useEffect(() => {
    let active = true
    void loadStoredApiUrl()
      .then((stored) => {
        if (active && stored) {
          setApiUrl(stored)
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  const handleApiUrlChange = (value: string): void => {
    setApiUrl(value)
    void saveStoredApiUrl(value).catch(() => undefined)
  }

  return {
    apiUrl,
    setApiUrl,
    email,
    setEmail,
    password,
    setPassword,
    displayName,
    setDisplayName,
    handleApiUrlChange,
  }
}
