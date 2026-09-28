# First Payday native apps: API contract (v1)

The iOS app (luisczul/firstpayday_ios) and the Android app (luisczul/firstpayday_android) talk only to the
web app at `https://firstpayday.app`. They hold **no Supabase keys**: sign-in goes through these endpoints.

## Conventions
- Base URL: `https://firstpayday.app` (debug builds may point at another origin, e.g. `http://10.0.2.2:3000`).
- JSON in and out (`Content-Type: application/json`), except `web-session` (a form POST, see below).
- Every request sends `Accept-Language: en|fr|es|pt` (the device language, mapped: fr-* → fr, es-* → es, pt-* → pt, else en).
  Error `message`s come back in that language and can be shown to the user as is.
- Authenticated calls send `Authorization: Bearer <accessToken>`.
- Errors: HTTP 4xx/5xx with `{ "error": { "code": string, "message": string } }`.
  Codes: `invalid_credentials`, `email_not_confirmed`, `invalid`, `unauthorized` (401: refresh, then retry once;
  if refresh fails, sign out), `forbidden`, `not_found`, `conflict`, `rate_limited`, `server`.
- Money is integer cents plus the home's ISO `currency` (format on device with the home `locale`).
- Times are ISO 8601 strings (UTC).
- The app identifies itself in every web view with a user-agent suffix: ` FirstPaydayApp/<version> (iOS)` or `(Android)`.
  The web then hides its own navigation, install button and log-out (the native app owns those).

## Auth
### POST /api/app/v1/auth/login
Body `{ "email": string, "password": string }`
200 → `Session`:
```json
{ "accessToken": "…", "refreshToken": "…", "expiresAt": 1790000000, "user": { "id": "uuid", "email": "a@b.c" } }
```
`expiresAt` is unix seconds. 401 `invalid_credentials`; 403 `email_not_confirmed`.

### POST /api/app/v1/auth/refresh
Body `{ "refreshToken": string }` → 200 `Session`, or 401 `unauthorized` (sign out).
Refresh proactively when `expiresAt` is < 60 s away, and on any 401.

### POST /api/app/v1/auth/signup
Body `{ "email": string, "password": string (min 8), "locale": "en|fr|es|pt", "acceptedTerms": true }`
200 → `{ "needsConfirmation": true }` (show "check your email, then log in") or
`{ "needsConfirmation": false, "session": Session }`. 409 `conflict` if the email already has an account.

### POST /api/app/v1/auth/logout  (Bearer)
Body `{ "pushToken"?: string }` → 204. Forgets that push token and ends the session server-side.
The app then deletes its stored tokens and clears web-view cookies/data.

Password reset: open `https://firstpayday.app/reset` in the system browser.
Terms / privacy: `https://firstpayday.app/terms`, `https://firstpayday.app/privacy`.

## Parent data (Bearer)
### GET /api/app/v1/me
```json
{
  "user": { "id": "uuid", "email": "a@b.c" },
  "household": null | { "id": "uuid", "name": "Czul family", "currency": "CAD", "locale": "en", "timezone": "America/Toronto" },
  "access": "full" | "read_only",
  "pendingCount": 3,
  "platformAdmin": false
}
```
`household: null` → the parent hasn't finished onboarding: open the web view at `/onboarding/home` (`/onboarding` redirects there)
(through `web-session`), and come back to native screens when the web view reaches `/admin…`.

### GET /api/app/v1/approvals
Chores waiting for the parent's check, oldest first.
```json
{
  "currency": "CAD", "locale": "en",
  "items": [{
    "id": "uuid",
    "kid": { "id": "uuid", "name": "Liam", "color": "#4F7A2E", "avatarUrl": "https://… | null" },
    "chore": { "id": "uuid | null", "title": "Clean two garbage bins", "emoji": "🗑️ | null" },
    "quantity": 1, "unitLabel": "bin | null", "unitPriceCents": 100, "amountCents": 100,
    "submittedAt": "2026-09-27T14:03:00Z", "resubmitted": false,
    "kidNote": "string | null", "photoUrl": "https://… | null"
  }]
}
```
`avatarUrl` can also be `preset:<name>` (a cartoon avatar): show the kid's initial on their color instead.

### POST /api/app/v1/approvals/{id}/approve
Body `{ "bonusCents"?: int (0..100000) }` → 200 `{ "ok": true }` (approving an already-approved chore again is a harmless no-op: no double payment). 409 `conflict` if it was rejected (a chore that was sent back can still be approved, as on the web).

### POST /api/app/v1/approvals/{id}/send-back
Body `{ "comment": string (1..500) }` → 200 `{ "ok": true }`.

### GET /api/app/v1/kids
```json
{ "currency": "CAD", "locale": "en",
  "items": [{ "id": "uuid", "name": "Liam", "color": "#…", "avatarUrl": "… | null", "balanceCents": 1500, "pendingCents": 100 }] }
```

## Account (Bearer)
### POST /api/app/v1/account/delete
Body `{ "confirmEmail": string }` (the parent retypes their email) → 204, or 400 `invalid` if it doesn't match.
Deletes the sign-in for good (App Store 5.1.1(v) / Google Play account deletion). A home the parent is alone in
is deleted with everything in it; a home shared with a co-parent stays with them. The app then clears its tokens
and web data and returns to Welcome. Show it natively under More → "Delete my account" with a clear warning.

## Push notifications (Bearer)
### POST /api/app/v1/push-tokens
Body `{ "token": string, "platform": "ios" | "android", "locale"?: "en|fr|es|pt" }` → 204 (idempotent).
### DELETE /api/app/v1/push-tokens
Body `{ "token": string }` → 204.

Pushes the server sends (when APNs / FCM credentials are configured on the server):
- A kid sent a chore: title "Liam finished a chore", body "Clean two garbage bins · $1.00" (in the parent's language).
  Data: `{ "type": "submission", "submissionId": "uuid" }` → open the Approvals tab.
  iOS: `aps.badge` = pending count, `thread-id` = "approvals".

## Web views
### POST /api/app/v1/web-session  (form: `application/x-www-form-urlencoded`)
Fields: `access_token` (`refresh_token` is accepted but not needed: the web view gets its own session), `next` (a path starting with `/`, default `/admin`), optional `mode=kiosk`.
Sets the web sign-in cookies for this web view and answers `303 See Other` to `next`.
With `mode=kiosk` it turns this device into the **kids' tablet** (the parent is signed out of the web view,
like the web's "Kids Mode" button) and redirects to `/kids`. The app then remembers "kids mode" and relaunches straight into it.

Load it as the first request of each web view (iOS: `URLRequest` with `httpMethod = "POST"`; Android: `WebView.postUrl`).
After a token refresh, the next web view load goes through `web-session` again.

Web paths used by the apps: `/admin/chores`, `/admin/payouts`, `/admin/history`, `/admin/settings`, `/admin/share`,
`/admin/support`, `/onboarding/home`, `/kids` (the kids' board; it has its own PIN-protected parent mode).
Links to other origins open in the system browser.
