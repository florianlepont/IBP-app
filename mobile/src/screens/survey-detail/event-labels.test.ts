import { fr } from "../../i18n"
import { eventTypeLabel, KNOWN_EVENT_TYPES } from "./event-labels"

describe("eventTypeLabel", () => {
  test("gives the French label of a submitted event", () => {
    expect(eventTypeLabel("submitted")).toBe(fr.surveyDetail.eventTypes.submitted)
  })

  test.each(KNOWN_EVENT_TYPES)("maps %s to its catalogue label", (type) => {
    const label = eventTypeLabel(type)
    expect(label).toBe(fr.surveyDetail.eventTypes[type])
    expect(label).not.toBe(type)
  })

  test("covers every event type the API writes and the data contract lists", () => {
    expect([...KNOWN_EVENT_TYPES].sort()).toEqual(
      [
        "attachment_created",
        "attachment_deleted",
        "attachment_uploaded",
        "backfilled",
        "created",
        "deleted",
        "expired",
        "reported",
        "submitted",
        "sync_failed",
        "synced",
        "updated",
        "visibility_changed",
      ].sort(),
    )
  })

  test("returns the generic French label for an unknown type, never the raw type", () => {
    expect(eventTypeLabel("some_new_type")).toBe(fr.surveyDetail.unknownEventType)
    expect(eventTypeLabel("toString")).toBe(fr.surveyDetail.unknownEventType)
    expect(eventTypeLabel("")).toBe(fr.surveyDetail.unknownEventType)
  })
})
