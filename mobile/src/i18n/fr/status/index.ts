import { appStatusFr } from "./app"
import { debugStatusFr } from "./debug"
import { editingStatusFr } from "./editing"
import { gpsStatusFr } from "./gps"
import { mapStatusFr } from "./map"
import { ownerStatusFr } from "./owner"
import { profileStatusFr } from "./profile"
import { sessionStatusFr } from "./session"
import { surveyOpsStatusFr } from "./survey-ops"
import { syncStatusFr } from "./sync"

// Status messages shown in the app's status line. Each entry is a function that
// returns a StatusMessage (see ../../status.ts); parameters carry names and
// counts only, never ids or raw error text.
export const statusFr = {
  app: appStatusFr,
  session: sessionStatusFr,
  owner: ownerStatusFr,
  sync: syncStatusFr,
  debug: debugStatusFr,
  surveyOps: surveyOpsStatusFr,
  profile: profileStatusFr,
  editing: editingStatusFr,
  gps: gpsStatusFr,
  map: mapStatusFr,
} as const
