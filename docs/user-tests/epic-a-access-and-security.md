# Test Plan — EPIC A: Access & Security

Based on [epic-a-access-and-security.md](../specs/epic-a-access-and-security.md).

Legend: ✅ Pass · ❌ Fail · ⚠️ Pass with issue · 🔲 Not tested

---

## US-A1 — Login

| # | Case | Expected result | Status | Notes |
|---|------|-----------------|--------|-------|
| A1-1 | Valid email + password | Redirected to home screen | ✅ | |
| A1-2 | Invalid email format | Clear error message displayed | ✅ | |
| A1-3 | Wrong password | Clear error message displayed | ✅ | |
| A1-4 | Close and reopen the app without logging out | Session still active | ✅ | |
| A1-5 | App launch while session is restoring | Branded loading screen — no flash of the login form | ✅ | Typewriter loader: scientific species names typed character by character on forest green background, permanent spinner on the left |
| A1-6 | Login screen | Two distinct buttons visible: "Se connecter" (primary) and "Créer un compte" (secondary) | ✅ | |
| A1-7 | Tap "Se connecter" | Light haptic feedback before Auth0 opens | ✅ | Not verified on a physical device — code is correct (`Haptics.impactAsync` before each action) |
| A1-8 | Auth0 error (e.g. wrong config) | User-friendly message displayed — no client ID, callback URL or technical detail visible | ✅ | |
| A1-9 | Bottom of login panel | "Conditions d'utilisation" and "Politique de confidentialité" links visible and tappable | ✅ | |
| A1-10 | Tap a legal link | Opens the corresponding page in the browser | ✅ | |

---

## US-A2 — Logout

| # | Case | Expected result | Status |
|---|------|-----------------|--------|
| A2-1 | Logout from the profile menu | Redirected to login screen | ✅ |
| A2-2 | Reopen the app after logout | Login screen shown (no active session) | ✅ |

---

## US-A3 — Sign Up

| # | Case | Expected result | Status | Notes |
|---|------|-----------------|--------|-------|
| A3-1 | Sign up with valid email + strong password | Automatically signed in and redirected to home screen | ✅ | |
| A3-2 | Invalid email format | Validation error shown on the form | ✅ | |
| A3-3 | Password too short / rules not met | Password rules clearly displayed, form blocked | ✅ | |
| A3-4 | Email already in use | Error message displayed with a suggestion to log in instead | ❌ | Auth0 shows a generic error instead of specifying the email is already taken |
| A3-5 | Network error during sign up | Actionable error message with retry option | ✅ | |
| A3-6 | Email verification flow | Verification email received, clear UX for both verified and unverified states | ✅ | |
| A3-7 | Tap "Créer un compte" | Auth0 opens directly on the sign-up form (not the login page) | ✅ | Requires New Universal Login on Auth0 tenant |

---

## US-A5 — Manage Profile

| # | Case | Expected result | Status | Notes |
|---|------|-----------------|--------|-------|
| A5-1 | Edit first name / last name / display name | Changes saved and visible after app restart | ✅ | Default display name was pre-filled with "Florian Lepont" |
| A5-2 | Upload profile picture from gallery | Profile picture updated | ✅ | |
| A5-3 | Upload profile picture from camera | Profile picture updated | ✅ | |
| A5-4 | Remove profile picture | Profile picture removed | ✅ | |
| A5-5 | Change email to one already taken | Alert "Email already taken" displayed | ✅ | |
| A5-6 | Change email to a valid unused address | Email updated, confirmation shown | 🔲 | Missing test case — to be verified |

---

## US-A6 — Forgot Password

| # | Case | Expected result | Status | Notes |
|---|------|-----------------|--------|-------|
| A6-1 | Tap "Mot de passe oublié ?" on login screen | Auth0 opens, user can enter their email to receive a reset link | 🔲 | Link now present directly on the login screen |
| A6-2 | Submit a recognised email | Reset email received with a secure single-use link | ⚠️ | Email received but landed in spam — related to iCloud SMTP issue (to be fixed with OVH) |
| A6-3 | Submit an unrecognised email | Informative message displayed | ✅ | |
| A6-4 | Use reset link after 24 hours | Link expired, error message shown | 🔲 | Not yet verified |
| A6-5 | Use reset link a second time | Link invalid, error message shown | ✅ | |
| A6-6 | Successful password reset | Redirected to login screen | ✅ | |

---

> **US-A4** (Extended login — Apple, Google, etc.) is scoped to V1 and excluded from this MVP test plan.

---

## Open issues

| ID | Issue | Priority |
|----|-------|----------|
| BUG-A3-4 | Auth0 sign-up shows generic error when email is already taken — should say "email already in use" | Medium |
| BUG-A6-2 | Password reset email lands in spam — caused by iCloud SMTP, pending OVH migration | Low (known, fix in progress) |
