# Test Plan — EPIC A: Access & Security

Based on [epic-a-access-and-security.md](../specs/epic-a-access-and-security.md).

---

## US-A1 — Login

| # | Case | Expected result |
|---|------|-----------------|
| A1-1 | Valid email + password | Redirected to home screen |
| A1-2 | Invalid email format | Clear error message displayed |
| A1-3 | Wrong password | Clear error message displayed |
| A1-4 | Close and reopen the app without logging out | Session still active |

---

## US-A2 — Logout

| # | Case | Expected result |
|---|------|-----------------|
| A2-1 | Logout from the profile menu | Redirected to login screen |
| A2-2 | Reopen the app after logout | Login screen shown (no active session) |

---

## US-A3 — Sign Up

| # | Case | Expected result |
|---|------|-----------------|
| A3-1 | Sign up with valid email + strong password | Automatically signed in and redirected to home screen |
| A3-2 | Invalid email format | Validation error shown on the form |
| A3-3 | Password too short / rules not met | Password rules clearly displayed, form blocked |
| A3-4 | Email already in use | Error message displayed with a suggestion to log in instead |
| A3-5 | Network error during sign up | Actionable error message with retry option |
| A3-6 | Email verification flow | Verification email received, clear UX for both verified and unverified states |

---

## US-A5 — Manage Profile

| # | Case | Expected result |
|---|------|-----------------|
| A5-1 | Edit first name / last name / display name | Changes saved and visible after app restart |
| A5-2 | Upload profile picture from gallery | Profile picture updated |
| A5-3 | Upload profile picture from camera | Profile picture updated |
| A5-4 | Remove profile picture | Profile picture removed |
| A5-5 | Change email to one already taken | Alert "Email already taken" displayed |

---

## US-A6 — Forgot Password

| # | Case | Expected result |
|---|------|-----------------|
| A6-1 | Tap "Forgot password?" on login screen | Email input form displayed |
| A6-2 | Submit a recognised email | Reset email received with a secure single-use link |
| A6-3 | Submit an unrecognised email | Informative message displayed |
| A6-4 | Use reset link after 24 hours | Link expired, error message shown |
| A6-5 | Use reset link a second time | Link invalid, error message shown |
| A6-6 | Successful password reset | Redirected to login screen |

---

> **US-A4** (Extended login — Apple, Google, etc.) is scoped to V1 and excluded from this MVP test plan.
