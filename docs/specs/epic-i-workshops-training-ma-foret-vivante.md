# Epic I - Workshops & Training "Ma Forêt Vivante"

**Release:** V1

Allow users to discover, browse and register for half-day workshops and 2.5-day training sessions organised by the association, with integration into the exploration map.

---

## User Stories

### US-I1 - Browse events calendar

**Release:** V1

A user can view the list of upcoming workshops and training sessions, with their type, date and location.

As a user, I want to see the list of upcoming workshops and training sessions so that I know what is available and when.

Acceptance criteria

- The calendar displays both event types: half-day workshops ("Ma Forêt Vivante") and 2.5-day training sessions.

- Each event shows its type, date, duration and location.

- Past events are not shown by default.

- The list is sorted by date ascending.

### US-I2 - View event details

**Release:** V1

A user can view the full details of a workshop or training session before deciding to register.

As a user, I want to view the full details of a workshop or training session so that I can decide whether I want to register.

Acceptance criteria

- The detail screen shows: event type, title, date(s), duration, location (forest parcel), number of available spots and a description.

- A clear call-to-action button leads to the registration step.

- If the event is full, the button is replaced by a "Full" indicator.

### US-I3 - Register for an event

**Release:** V1

A user can register for a workshop or training session. If a HelloAsso API is available, registration is handled in-app; otherwise the user is redirected to the HelloAsso website.

As a user, I want to register for a workshop or training session so that I can secure my spot easily.

Acceptance criteria

- If the HelloAsso API is available: registration is completed entirely within the app.

- If the HelloAsso API is not available: the user is redirected to the HelloAsso event page in an in-app browser.

- After a successful registration, the user receives a confirmation (in-app notification and/or email).

- The available spot count is updated in real time after registration.

### US-I4 - View my registrations

**Release:** V1

A logged-in user can view the list of events they have registered for.

As a user, I want to view my upcoming event registrations so that I can easily find the dates and details.

Acceptance criteria

- A "My registrations" section is accessible from the user's profile.

- Each registration shows the event name, date, duration and location.

- Past registrations are not shown by default.

### US-I5 - Display events on the exploration map

**Release:** V1

Workshops and training sessions are shown as pins on the exploration map, on the relevant forest parcels.

As a user, I want to see workshops and training sessions pinned on the exploration map so that I can discover events near me or in an area I am interested in.

Acceptance criteria

- Each upcoming event appears as a distinct pin on the map, positioned on its forest parcel.

- The pin visually differentiates between workshops and training sessions.

- Tapping a pin opens the event detail screen (US-I2).

- Past events are not shown on the map.
