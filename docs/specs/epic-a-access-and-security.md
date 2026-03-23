# EPIC A  - Access and Security

**Release:** MVP

Authentication, session management, and basic profile management for contributors.



---

## User Stories

### US-A1 - Login

**Release:** MVP

A contributor can log in with valid credentials to access surveys and profile, receiving a clear error message for invalid credentials, and the session remains active until logout or expiration.

As a contributor, I want to log in with my credentials so I can access my surveys and profile.

Acceptance criteria

- Given valid username/password, when I log in, then I am redirected to the home screen.

- Given invalid credentials, when I try to log in, then a clear error message is displayed.

- The session remains active between app launches (until logout or expiration).

### US-A2 - Logout

**Release:** MVP

Users can log out from the profile menu to secure their accounts on shared devices, and they will be redirected to the login screen after logging out.

As a user, I want to log out so my account is secure on shared devices.

Acceptance criteria:

- I can log out from the profile menu.

- After logout, I am redirected to the login screen.

### US-A3 - Create account (Sign up)

**Release:** MVP

New users can create an account through a sign-up flow initiated from the login screen, which validates email format and displays password rules. Duplicate emails are rejected with an error message. Upon successful sign-up, users are automatically logged in and redirected to the main screen. A verification step is included, and basic account data is stored server-side with an active session until logout. Errors are handled with actionable messages.

As a new contributor, I can create an account (sign up) so that I can log in and access my surveys and profile.

Acceptance criteria

- A new user can start the sign-up flow from the login screen.

- The flow supports email + password (aligned with US-A1).

- Email format is validated and password rules are clearly displayed (minimum length, complexity if required).

- Duplicate email is rejected with a clear error message and a suggestion to log in instead.

- After successful sign up, the user is automatically signed in and redirected to the main screen.

- A verification step is defined (email verification), with clear UX in both cases.

- Basic account data is persisted server-side and the session remains active until logout/expiration (aligned with US-A1/US-A2).

- Errors (network, server, validation) are handled with actionable messages and retry.

### US-A4 - Extended login 

**Release:** V1

A contributor can sign in using third-party providers (Apple, Google, etc.) in addition to username/password, with clear UX for first-time account linking, errors, and session persistence.

As a contributor, I want to log in using a third-party provider (Apple, Google, etc.) so I can access my surveys and profile without remembering another password.

Acceptance criteria

- The login screen offers provider buttons (at least Sign in with Apple and Sign in with Google) in addition to username/password.

- Given I select a provider and successfully authenticate, when I return to the app, then I am redirected to the home screen.

- Given the provider authentication is canceled or fails, then a clear error message is displayed and I remain on the login screen.

- Given it is my first time signing in with a provider, then I can either:

- Given the provider returns an email already associated with an existing account, then I am prompted to confirm linking (to prevent accidental duplicates).

- The session remains active between app launches (until logout or expiration).

- Logging out disconnects the local session and returns me to the login screen.

### US-A5 - Manage Profile

**Release:** MVP

Contributors can manage their profile information, including first name, last name, display name, and profile picture. Changes will be saved and visible after restarting the app, with support for uploading profile pictures from the camera or gallery. The display name will be used in community features while maintaining personal identity controls.

As a contributor, I want to manage my profile information so my account is personalized and up to date.

Acceptance criteria

- I can view and edit at least: first name, last name, display name, and profile picture.

- Changes are saved and visible after app restart.

- Profile picture upload supports camera and gallery selection.

- Display name is used in community surfaces (for example leaderboard) while keeping personal identity controls.
