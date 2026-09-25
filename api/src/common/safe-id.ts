// D-14: every id that reaches a storage key must match this pattern. Derived from every id
// format ever produced, so no existing production id is rejected:
// - survey ids are client-chosen TEXT; the mobile app has generated `survey-<Date.now()>`
//   (early App.tsx) and `randomUUID()` (expo-crypto, current);
// - attachment ids and user ids are server `randomUUID()` values;
// - E2E fixtures use ids such as `e2e-survey-<Date.now()>`.
// 128 matches the existing @MaxLength(128) on sync envelope ids.
export const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

export function isSafeId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID_PATTERN.test(value)
}
