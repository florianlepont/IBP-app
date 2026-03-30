import {
  AuthUser,
  PublicMapItem,
  PublicParcelStatusItem,
  SurveyDetailResponse,
  SurveyEventsResponse,
} from "../app/types"
import { apiRequest } from "./client"

type PatchProfilePayload = {
  first_name: string
  last_name: string
  display_name: string
  profile_picture_url?: string | null
}

type ProfilePictureUploadResponse = {
  profile_picture_url?: string
  message?: string
}

type ResetIbpDataResponse = {
  surveys_deleted?: number
  attachments_deleted?: number
  events_deleted?: number
  message?: string
}

type ResetUserDataResponse = {
  users_deleted?: number
  surveys_deleted?: number
  attachments_deleted?: number
  events_deleted?: number
  message?: string
}

type CreateReportResponse = {
  id: string
  status: "open" | "reviewed"
}

export async function getMyProfile(apiUrl: string, accessToken: string): Promise<AuthUser> {
  return apiRequest<AuthUser>({
    baseUrl: apiUrl,
    path: "/me",
    method: "GET",
    token: accessToken,
  })
}

export async function patchMyProfile(
  apiUrl: string,
  accessToken: string,
  payload: PatchProfilePayload,
): Promise<AuthUser> {
  return apiRequest<AuthUser>({
    baseUrl: apiUrl,
    path: "/me",
    method: "PATCH",
    token: accessToken,
    json: payload,
  })
}

export async function changeMyEmail(
  apiUrl: string,
  accessToken: string,
  email: string,
): Promise<void> {
  return apiRequest<void>({
    baseUrl: apiUrl,
    path: "/me/email",
    method: "PATCH",
    token: accessToken,
    json: { email },
  })
}

export async function uploadMyProfilePicture(
  apiUrl: string,
  accessToken: string,
  filePayload: FormData,
): Promise<ProfilePictureUploadResponse> {
  return apiRequest<ProfilePictureUploadResponse>({
    baseUrl: apiUrl,
    path: "/me/profile-picture",
    method: "PUT",
    token: accessToken,
    body: filePayload,
  })
}

export async function deleteMyProfilePicture(apiUrl: string, accessToken: string): Promise<void> {
  await apiRequest<void>({
    baseUrl: apiUrl,
    path: "/me/profile-picture",
    method: "DELETE",
    token: accessToken,
    expectJson: false,
  })
}

export async function loadSurveyDetail(
  apiUrl: string,
  accessToken: string,
  surveyId: string,
): Promise<SurveyDetailResponse> {
  return apiRequest<SurveyDetailResponse>({
    baseUrl: apiUrl,
    path: `/surveys/${surveyId}`,
    method: "GET",
    token: accessToken,
  })
}

export async function loadSurveyEvents(
  apiUrl: string,
  accessToken: string,
  surveyId: string,
): Promise<SurveyEventsResponse> {
  return apiRequest<SurveyEventsResponse>({
    baseUrl: apiUrl,
    path: `/surveys/${surveyId}/events`,
    method: "GET",
    token: accessToken,
  })
}

export async function resetIbpData(
  apiUrl: string,
  accessToken: string,
): Promise<ResetIbpDataResponse> {
  return apiRequest<ResetIbpDataResponse>({
    baseUrl: apiUrl,
    path: "/debug/reset-ibp-data",
    method: "POST",
    token: accessToken,
    json: {},
  })
}

export async function resetUserData(
  apiUrl: string,
  accessToken: string,
): Promise<ResetUserDataResponse> {
  return apiRequest<ResetUserDataResponse>({
    baseUrl: apiUrl,
    path: "/debug/reset-user-data",
    method: "POST",
    token: accessToken,
    json: {},
  })
}

export async function fetchPublicMapItems(
  apiUrl: string,
  input?: { from?: string; to?: string; region?: string },
): Promise<{ items: PublicMapItem[] }> {
  const queryParts: string[] = []
  if (input?.from?.trim()) queryParts.push(`from=${encodeURIComponent(input.from.trim())}`)
  if (input?.to?.trim()) queryParts.push(`to=${encodeURIComponent(input.to.trim())}`)
  if (input?.region?.trim())
    queryParts.push(`region=${encodeURIComponent(input.region.trim().toUpperCase())}`)
  const suffix = queryParts.length > 0 ? `?${queryParts.join("&")}` : ""

  return apiRequest<{ items: PublicMapItem[] }>({
    baseUrl: apiUrl,
    path: `/public/map-items${suffix}`,
    method: "GET",
  })
}

export async function fetchPublicParcelStatuses(
  apiUrl: string,
  input: { bbox: string; zoom: number; year?: number },
): Promise<{ items: PublicParcelStatusItem[] }> {
  const queryParts = [
    `bbox=${encodeURIComponent(input.bbox)}`,
    `zoom=${encodeURIComponent(String(Math.round(input.zoom)))}`,
  ]
  if (typeof input.year === "number" && Number.isFinite(input.year)) {
    queryParts.push(`year=${encodeURIComponent(String(Math.trunc(input.year)))}`)
  }

  return apiRequest<{ items: PublicParcelStatusItem[] }>({
    baseUrl: apiUrl,
    path: `/public/parcels/status?${queryParts.join("&")}`,
    method: "GET",
  })
}

export async function createSurveyReport(
  apiUrl: string,
  accessToken: string,
  input: { survey_id: string; reason: string },
): Promise<CreateReportResponse> {
  return apiRequest<CreateReportResponse>({
    baseUrl: apiUrl,
    path: "/reports",
    method: "POST",
    token: accessToken,
    json: input,
  })
}

export type { PatchProfilePayload, ResetIbpDataResponse, ResetUserDataResponse }
