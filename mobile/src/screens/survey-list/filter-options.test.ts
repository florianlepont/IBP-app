import { fr } from "../../i18n"
import {
  ATTACHMENT_OPTIONS,
  BLOCKED_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  SYNC_OPTIONS,
} from "./filter-options"
import type { FilterOption } from "./filter-options"

// T-01.9-48: moving the labels to the catalogue must not change the filter
// values (or their order), or the list would show the wrong surveys.
const values = <T extends string>(options: ReadonlyArray<FilterOption<T>>) =>
  options.map((option) => option.value)

const expectCatalogueLabels = <T extends string>(
  options: ReadonlyArray<FilterOption<T>>,
  labels: Record<T, string>,
) => {
  for (const option of options) {
    expect(option.label).toBe(labels[option.value])
  }
  expect(Object.keys(labels).sort()).toEqual([...values(options)].sort())
}

describe("survey list filter options", () => {
  const { options } = fr.surveyList.filters

  test("status options keep their values and read their labels from the catalogue", () => {
    expect(values(STATUS_OPTIONS)).toEqual(["all", "draft", "submitted", "expired"])
    expectCatalogueLabels(STATUS_OPTIONS, options.status)
  })

  test("sync options keep their values and read their labels from the catalogue", () => {
    expect(values(SYNC_OPTIONS)).toEqual(["all", "pending", "synced", "failed"])
    expectCatalogueLabels(SYNC_OPTIONS, options.sync)
  })

  test("blocked options keep their values and read their labels from the catalogue", () => {
    expect(values(BLOCKED_OPTIONS)).toEqual(["all", "blocked", "unblocked"])
    expectCatalogueLabels(BLOCKED_OPTIONS, options.blocked)
  })

  test("attachment options keep their values and read their labels from the catalogue", () => {
    expect(values(ATTACHMENT_OPTIONS)).toEqual(["all", "with", "without"])
    expectCatalogueLabels(ATTACHMENT_OPTIONS, options.attachment)
  })

  test("sort options keep their values and read their labels from the catalogue", () => {
    expect(values(SORT_OPTIONS)).toEqual(["updated_desc", "updated_asc", "site_asc"])
    expectCatalogueLabels(SORT_OPTIONS, options.sort)
  })

  test("labels are French words, not the raw values", () => {
    const all = [STATUS_OPTIONS, SYNC_OPTIONS, BLOCKED_OPTIONS, ATTACHMENT_OPTIONS, SORT_OPTIONS]
    for (const group of all) {
      for (const option of group as ReadonlyArray<FilterOption<string>>) {
        expect(option.label).not.toBe(option.value)
        expect(option.label.length).toBeGreaterThan(0)
      }
    }
    expect(STATUS_OPTIONS[1]?.label).toBe("Brouillon")
    expect(SORT_OPTIONS[0]?.label).toBe("Récent en premier")
  })
})
