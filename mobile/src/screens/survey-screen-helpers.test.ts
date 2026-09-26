import {
  asFiniteNumber,
  isFactorKey,
  isPhotoAttachment,
  LOADING_PHOTO_MESSAGE,
  MISSING_PHOTO_MESSAGE,
  resolveAttachmentPreview,
  resolveDisplayCoordinates,
  selectPreviewCandidates,
  toAddressLabel,
  UNAVAILABLE_PHOTO_MESSAGE,
} from "./survey-screen-helpers"
import type { LocalAttachment } from "../storage/types"
import { fr } from "../i18n"

const attachment = (overrides: Partial<LocalAttachment> = {}): LocalAttachment => ({
  id: "attachment-1",
  survey_id: "survey-1",
  local_uri: "",
  mime_type: "image/jpeg",
  size_bytes: 1000,
  sync_state: "synced",
  remote_attachment_id: null,
  storage_key: null,
  upload_url: null,
  confirm_url: null,
  last_sync_error: null,
  last_sync_error_code: null,
  last_sync_error_at: null,
  updated_at: "2026-09-25T00:00:00.000Z",
  file_state: "local",
  ...overrides,
})

describe("survey screen helpers", () => {
  it("formats address labels by concatenating available parts", () => {
    expect(
      toAddressLabel({
        streetNumber: "12",
        street: "Rue des Chenes",
        postalCode: "75001",
        city: "Paris",
        region: "Ile-de-France",
        country: "France",
      }),
    ).toBe("12 Rue des Chenes - 75001 Paris - Ile-de-France, France")

    expect(
      toAddressLabel({
        city: "Toulouse",
        country: "France",
      }),
    ).toBe("Toulouse - France")
  })

  it("parses finite numbers and resolves display coordinates safely", () => {
    expect(asFiniteNumber(12.5)).toBe(12.5)
    expect(asFiniteNumber("42")).toBe(42)
    expect(asFiniteNumber("not-a-number")).toBeNull()

    expect(resolveDisplayCoordinates({ lat: "48.8566", lng: 2.3522 })).toEqual({
      lat: 48.8566,
      lng: 2.3522,
    })
    expect(resolveDisplayCoordinates({ lat: "x", lng: 2.3522 })).toBeNull()
    expect(resolveDisplayCoordinates(null)).toBeNull()
  })

  it("recognizes valid factor keys only", () => {
    expect(isFactorKey("A")).toBe(true)
    expect(isFactorKey("J")).toBe(true)
    expect(isFactorKey("Z")).toBe(false)
  })

  describe("isPhotoAttachment", () => {
    it("is true for image mime types and false for others", () => {
      expect(isPhotoAttachment(attachment({ mime_type: "image/jpeg" }))).toBe(true)
      expect(isPhotoAttachment(attachment({ mime_type: "image/png" }))).toBe(true)
      expect(isPhotoAttachment(attachment({ mime_type: "image/heic" }))).toBe(true)
      expect(isPhotoAttachment(attachment({ mime_type: "application/pdf" }))).toBe(false)
      expect(isPhotoAttachment(attachment({ mime_type: "application/octet-stream" }))).toBe(false)
    })
  })

  describe("resolveAttachmentPreview", () => {
    it("resolves a local file to an image preview", () => {
      expect(
        resolveAttachmentPreview({
          file_state: "local",
          local_uri: "file:///mock/documents/attachments/a.jpg",
        }),
      ).toEqual({ kind: "image", uri: "file:///mock/documents/attachments/a.jpg" })
    })

    it("re-bases an old-container local uri", () => {
      const result = resolveAttachmentPreview({
        file_state: "local",
        local_uri: "file:///old-container-uuid/Documents/attachments/a.jpg",
      })
      expect(result).toEqual({
        kind: "image",
        uri: expect.stringContaining("attachments/a.jpg"),
      })
      if (result.kind === "image") {
        expect(result.uri).not.toContain("old-container-uuid")
      }
    })

    it("shows a loading state for a local row with an empty uri", () => {
      expect(resolveAttachmentPreview({ file_state: "local", local_uri: "" })).toEqual({
        kind: "loading",
        message: LOADING_PHOTO_MESSAGE,
      })
    })

    it("shows a loading state for a remote row", () => {
      expect(resolveAttachmentPreview({ file_state: "remote", local_uri: "" })).toEqual({
        kind: "loading",
        message: LOADING_PHOTO_MESSAGE,
      })
    })

    it("shows a missing state for a missing row", () => {
      expect(resolveAttachmentPreview({ file_state: "missing", local_uri: "" })).toEqual({
        kind: "missing",
        message: MISSING_PHOTO_MESSAGE,
      })
    })

    it("shows a distinct unavailable state for an unavailable row", () => {
      expect(resolveAttachmentPreview({ file_state: "unavailable", local_uri: "" })).toEqual({
        kind: "unavailable",
        message: UNAVAILABLE_PHOTO_MESSAGE,
      })
    })
  })

  describe("preview messages", () => {
    it("read the same French texts from fr.labels", () => {
      expect(MISSING_PHOTO_MESSAGE).toBe(fr.labels.attachmentPreview.missing)
      expect(LOADING_PHOTO_MESSAGE).toBe(fr.labels.attachmentPreview.loading)
      expect(UNAVAILABLE_PHOTO_MESSAGE).toBe(fr.labels.attachmentPreview.unavailable)
      expect(MISSING_PHOTO_MESSAGE).toBe(
        "Photo introuvable sur cet appareil. Supprimez-la ou reprenez la photo.",
      )
      expect(LOADING_PHOTO_MESSAGE).toBe("Photo en cours de chargement…")
      expect(UNAVAILABLE_PHOTO_MESSAGE).toBe("Photo non disponible pour le moment.")
    })
  })

  describe("selectPreviewCandidates", () => {
    it("selects only remote/local photo attachments, excluding missing/unavailable and non-photos", () => {
      const attachments = [
        attachment({ id: "a1", file_state: "local" }),
        attachment({ id: "a2", file_state: "remote" }),
        attachment({ id: "a3", file_state: "missing" }),
        attachment({ id: "a4", file_state: "unavailable" }),
        attachment({ id: "a5", file_state: "remote", mime_type: "application/pdf" }),
      ]

      expect(selectPreviewCandidates(attachments).map((a) => a.id)).toEqual(["a1", "a2"])
    })
  })
})
