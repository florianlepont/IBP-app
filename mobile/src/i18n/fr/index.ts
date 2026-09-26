import { accountFr } from "./account"
import { authGateFr } from "./auth-gate"
import { commonFr } from "./common"
import { componentsFr } from "./components"
import { factorDetailFr } from "./factor-detail"
import { homeFr } from "./home"
import { labelsFr } from "./labels"
import { navigationFr } from "./navigation"
import { ownerConflictFr } from "./owner-conflict"
import { parcelSelectionFr } from "./parcel-selection"
import { profileSetupFr } from "./profile-setup"
import { publicMapFr } from "./public-map"
import { settingsFr } from "./settings"
import { statusFr } from "./status"
import { surveyDetailFr } from "./survey-detail"
import { surveyFormFr } from "./survey-form"
import { surveyListFr } from "./survey-list"
import { syncErrorsFr } from "./sync-errors"
import { validationFr } from "./validation"

// The French catalogue (D-06): one section per file, so each plan fills its own
// section without editing a shared one. No i18n library: property access is
// checked by the compiler.
export const fr = {
  common: commonFr,
  syncErrors: syncErrorsFr,
  navigation: navigationFr,
  home: homeFr,
  components: componentsFr,
  surveyList: surveyListFr,
  surveyDetail: surveyDetailFr,
  surveyForm: surveyFormFr,
  factorDetail: factorDetailFr,
  parcelSelection: parcelSelectionFr,
  profileSetup: profileSetupFr,
  ownerConflict: ownerConflictFr,
  settings: settingsFr,
  labels: labelsFr,
  authGate: authGateFr,
  account: accountFr,
  publicMap: publicMapFr,
  validation: validationFr,
  status: statusFr,
} as const

// Maps string literal types to string, recursively, and keeps function types, so
// a second language would be written as `const en: Catalog = { ... }`.
type Widen<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends string
    ? string
    : T extends object
      ? { readonly [K in keyof T]: Widen<T[K]> }
      : T

export type Catalog = Widen<typeof fr>
