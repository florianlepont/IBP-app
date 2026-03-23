# Epic A - Access and Security

## Scope
Authentication, session management, and basic profile management for contributors.

## User Stories

### US-A1 - Login
As a contributor, I want to log in with my credentials so I can access my surveys and profile.

Acceptance criteria:
- Given valid username/password, when I log in, then I am redirected to the home screen.
- Given invalid credentials, when I try to log in, then a clear error message is displayed.
- The session remains active between app launches (until logout or expiration).

### US-A2 - Logout
As a user, I want to log out so my account is secure on shared devices.

Acceptance criteria:
- I can log out from the profile menu.
- After logout, I am redirected to the login screen.

### US-A3 - Manage Profile
As a contributor, I want to manage my profile information so my account is personalized and up to date.

Acceptance criteria:
- I can view and edit at least: first name, last name, display name, and profile picture.
- Changes are saved and visible after app restart.
- Profile picture upload supports camera and gallery selection.
- Display name is used in community surfaces (for example leaderboard) while keeping personal identity controls.
