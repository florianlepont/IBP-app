const mockApiRequest = jest.fn()

jest.mock("./client", () => ({
  apiRequest: mockApiRequest,
}))

import {
  confirmMyEmail,
  createSurveyReport,
  deleteMyProfilePicture,
  fetchPublicMapItems,
  fetchPublicParcelStatuses,
  getMyProfile,
  loadSurveyDetail,
  loadSurveyEvents,
  loginWithCredentials,
  logoutSession,
  patchMyProfile,
  refreshAuthTokens,
  registerWithCredentials,
  resendVerificationEmail,
  resetIbpData,
  resetUserData,
  uploadMyProfilePicture,
  verifyEmail,
} from "./ibp-api"

describe("ibp-api", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockApiRequest.mockResolvedValue({})
  })

  it("builds auth requests with the expected payloads", async () => {
    await loginWithCredentials("https://api.example.com", "user@example.com", "secret", {
      createIfMissing: false,
    })
    await registerWithCredentials("https://api.example.com", "user@example.com", "secret", "User")
    await refreshAuthTokens("https://api.example.com", "refresh-token")
    await verifyEmail("https://api.example.com", "verify-token")
    await resendVerificationEmail("https://api.example.com", "user@example.com")
    await logoutSession("https://api.example.com", "access-token")

    expect(mockApiRequest.mock.calls).toEqual([
      [
        {
          baseUrl: "https://api.example.com",
          path: "/auth/login",
          method: "POST",
          json: {
            email: "user@example.com",
            password: "secret",
            create_if_missing: false,
          },
        },
      ],
      [
        {
          baseUrl: "https://api.example.com",
          path: "/auth/register",
          method: "POST",
          json: {
            email: "user@example.com",
            password: "secret",
            display_name: "User",
          },
        },
      ],
      [
        {
          baseUrl: "https://api.example.com",
          path: "/auth/refresh",
          method: "POST",
          json: { refresh_token: "refresh-token" },
        },
      ],
      [
        {
          baseUrl: "https://api.example.com",
          path: "/auth/verify-email",
          method: "POST",
          json: { token: "verify-token" },
          expectJson: false,
        },
      ],
      [
        {
          baseUrl: "https://api.example.com",
          path: "/auth/resend-verification",
          method: "POST",
          json: { email: "user@example.com" },
        },
      ],
      [
        {
          baseUrl: "https://api.example.com",
          path: "/auth/logout",
          method: "POST",
          token: "access-token",
          expectJson: false,
        },
      ],
    ])
  })

  it("builds authenticated profile and debug requests", async () => {
    const formData = new FormData()

    await getMyProfile("https://api.example.com", "access-token")
    await patchMyProfile("https://api.example.com", "access-token", {
      first_name: "Flo",
      last_name: "Lepont",
      display_name: "Algernon",
      email: "florian@example.com",
      profile_picture_url: null,
    })
    await confirmMyEmail("https://api.example.com", "access-token", "confirm-token")
    await uploadMyProfilePicture("https://api.example.com", "access-token", formData)
    await deleteMyProfilePicture("https://api.example.com", "access-token")
    await resetIbpData("https://api.example.com", "access-token")
    await resetUserData("https://api.example.com", "access-token")
    await createSurveyReport("https://api.example.com", "access-token", {
      survey_id: "survey-1",
      reason: "Needs moderation",
    })

    expect(mockApiRequest.mock.calls).toEqual([
      [
        {
          baseUrl: "https://api.example.com",
          path: "/me",
          method: "GET",
          token: "access-token",
        },
      ],
      [
        {
          baseUrl: "https://api.example.com",
          path: "/me",
          method: "PATCH",
          token: "access-token",
          json: {
            first_name: "Flo",
            last_name: "Lepont",
            display_name: "Algernon",
            email: "florian@example.com",
            profile_picture_url: null,
          },
        },
      ],
      [
        {
          baseUrl: "https://api.example.com",
          path: "/me/email/confirm",
          method: "POST",
          token: "access-token",
          json: { token: "confirm-token" },
        },
      ],
      [
        {
          baseUrl: "https://api.example.com",
          path: "/me/profile-picture",
          method: "PUT",
          token: "access-token",
          body: formData,
        },
      ],
      [
        {
          baseUrl: "https://api.example.com",
          path: "/me/profile-picture",
          method: "DELETE",
          token: "access-token",
          expectJson: false,
        },
      ],
      [
        {
          baseUrl: "https://api.example.com",
          path: "/debug/reset-ibp-data",
          method: "POST",
          token: "access-token",
          json: {},
        },
      ],
      [
        {
          baseUrl: "https://api.example.com",
          path: "/debug/reset-user-data",
          method: "POST",
          token: "access-token",
          json: {},
        },
      ],
      [
        {
          baseUrl: "https://api.example.com",
          path: "/reports",
          method: "POST",
          token: "access-token",
          json: {
            survey_id: "survey-1",
            reason: "Needs moderation",
          },
        },
      ],
    ])
  })

  it("builds survey detail and events endpoints", async () => {
    await loadSurveyDetail("https://api.example.com", "access-token", "survey-1")
    await loadSurveyEvents("https://api.example.com", "access-token", "survey-1")

    expect(mockApiRequest.mock.calls).toEqual([
      [
        {
          baseUrl: "https://api.example.com",
          path: "/surveys/survey-1",
          method: "GET",
          token: "access-token",
        },
      ],
      [
        {
          baseUrl: "https://api.example.com",
          path: "/surveys/survey-1/events",
          method: "GET",
          token: "access-token",
        },
      ],
    ])
  })

  it("builds public map and parcel status queries", async () => {
    await fetchPublicMapItems("https://api.example.com", {
      from: "2026-01-01",
      to: "2026-12-31",
      region: "aca",
    })
    await fetchPublicMapItems("https://api.example.com")
    await fetchPublicParcelStatuses("https://api.example.com", {
      bbox: "1.0,43.0,2.0,44.0",
      zoom: 15.7,
      year: 2026.9,
    })
    await fetchPublicParcelStatuses("https://api.example.com", {
      bbox: "1.0,43.0,2.0,44.0",
      zoom: 16,
    })

    expect(mockApiRequest.mock.calls).toEqual([
      [
        {
          baseUrl: "https://api.example.com",
          path: "/public/map-items?from=2026-01-01&to=2026-12-31&region=ACA",
          method: "GET",
        },
      ],
      [
        {
          baseUrl: "https://api.example.com",
          path: "/public/map-items",
          method: "GET",
        },
      ],
      [
        {
          baseUrl: "https://api.example.com",
          path: "/public/parcels/status?bbox=1.0%2C43.0%2C2.0%2C44.0&zoom=16&year=2026",
          method: "GET",
        },
      ],
      [
        {
          baseUrl: "https://api.example.com",
          path: "/public/parcels/status?bbox=1.0%2C43.0%2C2.0%2C44.0&zoom=16",
          method: "GET",
        },
      ],
    ])
  })
})
