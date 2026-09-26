const mockApiRequest = jest.fn()

jest.mock("./client", () => ({
  apiRequest: mockApiRequest,
}))

import {
  createSurveyReport,
  deleteMyAccount,
  deleteMyProfilePicture,
  fetchPublicMapItems,
  fetchPublicParcelStatuses,
  getAttachmentDownloadUrl,
  getMyProfile,
  loadSurveyDetail,
  loadSurveyEvents,
  patchMyProfile,
  resetIbpData,
  resetUserData,
  uploadMyProfilePicture,
} from "./ibp-api"

describe("ibp-api", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockApiRequest.mockResolvedValue({})
  })

  it("builds authenticated profile and debug requests", async () => {
    const formData = new FormData()

    await getMyProfile("https://api.example.com", "access-token")
    await patchMyProfile("https://api.example.com", "access-token", {
      first_name: "Flo",
      last_name: "Lepont",
      display_name: "Algernon",
      profile_picture_url: null,
    })
    await uploadMyProfilePicture("https://api.example.com", "access-token", formData)
    await deleteMyProfilePicture("https://api.example.com", "access-token")
    await deleteMyAccount("https://api.example.com", "access-token")
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
            profile_picture_url: null,
          },
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
          path: "/me",
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

  it("builds an attachment download-url request with encoded ids", async () => {
    await getAttachmentDownloadUrl("https://api.example.com", "access-token", "s 1", "a/1")

    expect(mockApiRequest.mock.calls).toEqual([
      [
        {
          baseUrl: "https://api.example.com",
          path: "/surveys/s%201/attachments/a%2F1/download-url",
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

  it("adds the bbox to the public map query only when it is given", async () => {
    await fetchPublicMapItems("https://api.example.com", { bbox: "1,2,3,4" })
    await fetchPublicMapItems("https://api.example.com", { bbox: "1,2,3,4", region: "ara" })
    await fetchPublicMapItems("https://api.example.com", { bbox: "   " })

    expect(mockApiRequest.mock.calls.map(([request]) => request.path)).toEqual([
      "/public/map-items?bbox=1%2C2%2C3%2C4",
      "/public/map-items?region=ARA&bbox=1%2C2%2C3%2C4",
      "/public/map-items",
    ])
  })
})
