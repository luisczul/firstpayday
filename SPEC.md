# Chore Board — Build Spec (A to Z)

> **For the coding agent.** This file is the full brief for building a kid-friendly chore and allowance web app. Read it end to end before writing code. Build in the phases in §14, and don't stop to ask about anything this spec already decides. Open questions and their default answers are in §16. If one of them blocks you, use the default and keep going.

---

## 1. What we're building

Families use this web app to run paid extra chores for their kids.

- A **parent (admin)** creates a household, adds kids (a name and an optional photo), and sets up chores from templates. Each chore has a price and a repeat rule.
- A **shared kitchen tablet** (iPad or Android, **landscape**) stays in **Kids Mode**. Kids never type a password. They tap their face, see their chore cards and their money, and tap **"I did it!"** when a chore is done.
- Each completed chore goes to the parent's **approval queue**. The parent can **approve** it, which adds the money to that kid's balance, or **send it back** with a comment, which returns the card to the kid marked "Needs fixing".
- Chores repeat on a schedule. Once done, a card **disappears** until it's available again (for example, baseboards every 14 days). A **"New & coming back"** section shows kids what just appeared and what comes back soon.
- The parent records **payouts** (cash handed over, a deposit to savings), and each payout is deducted from the kid's balance.

**Deployment:** `kids.diegoczul.com`.
**This is a public, paid SaaS product from v1.** Anyone can sign up, start a free trial, create a household, add kids, start from templates, and subscribe with Stripe. Diego's household is simply the first customer (on a complimentary plan). **Every table and query is multi-tenant.** Nothing may be hard-coded to Diego's account. Billing is in §19, and the platform owner console is in §20.

---

## 2. Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 15** (App Router, TypeScript, Server Actions, Route Handlers) |
| Styling | **Tailwind CSS v4** + a small in-house component set (no heavy UI kit on the kid side; shadcn/ui is fine for admin) |
| Animation | Framer Motion (card enter/exit, confetti via `canvas-confetti`) |
| Backend | **Supabase**: Postgres, Auth (email + password for parents), Storage (kid avatars), Realtime (live approval queue and kiosk refresh) |
| Hosting | **Vercel**, custom domain `kids.diegoczul.com` |
| Billing | **Stripe**: Checkout (subscriptions), Customer Portal, webhooks, Stripe Tax (GST/QST/HST) |
| Email | Supabase Auth emails for v1; Resend for transactional mail (trial ending, payment failed) |
| Validation | Zod |
| Dates | `date-fns` + `date-fns-tz` (all schedule logic runs in the **household's timezone**) |
| Testing | Vitest for the scheduling and ledger logic, Playwright for the three main flows (§15) |
| Package manager | pnpm |

The GitHub repo will be provided. Scaffold into it.

---

## 3. Core concepts and vocabulary

| Term | Meaning |
|---|---|
| **Account / Parent** | A Supabase Auth user. Can belong to one or more households. |
| **Household** | The tenant. Owns kids, chores, devices, ledger. Has a timezone and currency. |
| **Member** | A parent's link to a household, with role `owner` or `parent`. A co-parent can be invited. |
| **Kid** | A profile inside a household: name, optional photo, color. **Kids are not auth users.** |
| **Chore** | A task card: title, description, price, unit, repeat rule, who it's for. |
| **Template** | A starter chore offered during household setup. Copied into the household (never linked live). |
| **Submission** | One "I did it!" tap. Moves through `pending → approved`, or `pending → sent_back → pending (resubmitted) → approved`. A parent can also `reject` one (no money, and it doesn't come back). |
| **Ledger entry** | An immutable money row: `earning` (+), `payout` (−), `adjustment` (±), `match` (+, optional savings match). **Balance = sum of ledger rows.** |
| **Device (kiosk)** | A browser (the kitchen tablet) authorized to show one household in Kids Mode without a login. |
| **Kids Mode / Admin Mode** | The two modes of the tablet (§7). |

---

## 4. Data model (Supabase / Postgres)

Store money as **integer cents** (`int`), never floats. Every table has `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()` and `household_id` wherever it applies.

```sql
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/Toronto',
  currency text not null default 'CAD',
  locale text not null default 'en',
  admin_timeout_minutes int not null default 30,
  kid_idle_seconds int not null default 90,
  savings_match_percent int not null default 0,
  week_starts_on int not null default 1,
  plan text not null default 'free',
  stripe_customer_id text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table household_members (
  household_id uuid references households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','parent')),
  display_name text,
  created_at timestamptz default now(),
  primary key (household_id, user_id)
);

create table household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  email text not null,
  role text not null default 'parent',
  token_hash text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

create table kids (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  avatar_path text,
  color text not null default '#E08A1E',
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz default now()
);

create table chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  template_key text,
  title text not null,
  description text,
  emoji text,
  color text,
  price_cents int not null check (price_cents >= 0),
  unit_label text,
  max_quantity int not null default 1,
  repeat_kind text not null check (repeat_kind in ('once','daily','weekly','every_n_days')),
  repeat_every_days int,
  scope text not null default 'household' check (scope in ('household','per_kid')),
  requires_approval boolean not null default true,
  note_for_kids text,
  available_from date,
  available_until date,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table chore_assignees (
  chore_id uuid references chores(id) on delete cascade,
  kid_id uuid references kids(id) on delete cascade,
  primary key (chore_id, kid_id)
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  chore_id uuid not null references chores(id) on delete restrict,
  kid_id uuid not null references kids(id) on delete restrict,
  quantity int not null default 1,
  unit_price_cents int not null,
  amount_cents int not null,
  chore_title_snapshot text not null,
  status text not null check (status in ('pending','approved','sent_back','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  review_comment text,
  device_id uuid,
  created_at timestamptz default now()
);

create table submission_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete cascade,
  event text not null check (event in ('submitted','resubmitted','approved','sent_back','rejected')),
  comment text,
  actor_user_id uuid,
  created_at timestamptz default now()
);

create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete restrict,
  kind text not null check (kind in ('earning','payout','adjustment','match')),
  amount_cents int not null,
  submission_id uuid references submissions(id),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null default 'Kitchen tablet',
  token_hash text not null unique,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table chore_templates (
  key text primary key,
  title text not null,
  description text,
  emoji text,
  price_cents int not null,
  unit_label text,
  max_quantity int not null default 1,
  repeat_kind text not null,
  repeat_every_days int,
  scope text not null default 'household',
  season text,
  category text,
  locale text not null default 'en',
  sort_order int not null default 0
);
```

Billing and platform tables (details in §19–20):

```sql
create table subscriptions (
  household_id uuid primary key references households(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan text not null default 'trial' check (plan in ('trial','family','family_plus','comp','free')),
  status text not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz default now()
);

create table stripe_events (
  id text primary key,
  type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz default now()
);

create table platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
```

- `households.plan` and `households.stripe_customer_id` from above move into `subscriptions`. Drop them from `households`.
- `subscriptions` and `stripe_events` are **written only by the server** (the webhook handler, using the service role). Parents may **select** their own household's subscription row. There's no insert or update policy for them.

Notes:
- A **`kid_balances` view**: `select kid_id, sum(amount_cents) balance_cents from ledger_entries group by kid_id`. Add **pending_cents** (sum of `pending` submissions) so kids see "waiting for check" money separately.
- `ledger_entries` is **append-only**. Nobody edits or deletes a row. To correct a mistake, add an `adjustment` row. Enforce this with RLS (no update or delete policy) and a trigger that raises on UPDATE/DELETE.
- Archive kids with `archived_at` instead of deleting them, so history stays intact. The same goes for chores (`active=false`). A chore that has submissions can't be hard-deleted.
- A `chore_assignees` table with no rows for a chore means **all kids** can do it.
- Indexes: `submissions (household_id, status)`, `submissions (chore_id, kid_id, submitted_at desc)`, `ledger_entries (kid_id)`.

### Row-Level Security

- Enable RLS on **every** table.
- Helper: `is_member(hid uuid)` returns `exists (select 1 from household_members where household_id = hid and user_id = auth.uid())`.
- Parents can select, insert and update rows where `is_member(household_id)`.
- `chore_templates` can be read by any authenticated user.
- **Kiosk (Kids Mode) requests never use a parent session.** They go through Next.js Route Handlers or Server Actions that:
  1. read the `kiosk_token` httpOnly cookie,
  2. hash it and look up `devices` (not revoked) to get the `household_id`,
  3. use the **service-role client** on the server, **always filtered by that household_id**.
  Kiosk endpoints may only do these things: list kids, list the chore board for a kid, create or resubmit a submission, and read balances and history for a kid. **Nothing else.** Put this whitelist in one module (`lib/kiosk/`) so it's easy to audit.
- The service-role key is used only in server code. Never ship it to the client.

---

## 5. Scheduling rules: when a card shows, hides and comes back

All boundaries use the **household timezone**.

| `repeat_kind` | Card is available again when… |
|---|---|
| `once` | Never, after one approved submission. (If it's sent back or rejected, it stays available.) |
| `daily` | Next local midnight after the last submission. |
| `weekly` | Start of the next week (`week_starts_on`, default Monday 00:00 local) after the last submission. |
| `every_n_days` | `last_submission.submitted_at + N days`, rounded **down to local midnight** so it reappears at the start of a day rather than mid-afternoon. |

- The **cooldown starts when the kid taps "I did it!"** (status `pending`), not at approval. That way the card disappears right away and nobody taps it twice.
- **Sent back:** the card goes to that kid's **"Needs fixing"** section with the parent's comment and a **"Fixed it!"** button, which resubmits the same submission. Cooldown still counts from the first tap.
- **Rejected:** the submission is closed with no money. For `once` chores the card becomes available again. For repeating chores the cooldown still applies (so a rejection can't be used to farm the chore).
- **Scope:**
  - `household` (default for house chores like baseboards or the barbecue): when **any** kid submits, the card disappears for **all** kids. First come, first served.
  - `per_kid` (for things like "tidy your own closet"): each kid has their own cooldown.
- **Seasonal window:** `available_from` / `available_until`. Outside the window the card is hidden, and it appears in "Coming back soon" if the start date is within 14 days.
- **Assignment:** if `chore_assignees` has rows, only those kids see the card.

Put all of this in **one pure function** with thorough unit tests:

```ts
getChoreState(chore, lastSubmissions, kidId, now, household): {
  state: 'available' | 'pending' | 'needs_fixing' | 'cooldown' | 'done_forever' | 'out_of_season' | 'not_assigned',
  availableAt?: Date,
  becameAvailableAt?: Date,
  submission?: Submission
}
```

`becameAvailableAt` drives the **"New!"** badge. A card is **New** if it became available within the last **72 hours** *or* since that kid last opened their board (store `kids.last_seen_board_at`, updated on board open), whichever gives more cards. A brand-new chore counts as new from its `created_at`.

---

## 6. Kid experience (Kids Mode)

### Device and layout
- Primary target: **iPad in landscape** (1024×768, 1180×820, 1366×1024). It must also work on an Android tablet in landscape. Portrait works but isn't the focus.
- Installable **PWA**: `manifest.webmanifest` with `display: "standalone"`, `orientation: "landscape"`, icons and theme color, so "Add to Home Screen" opens it full-screen like an app. On Android Chrome, "Install app" does the same.
- Tap targets are **at least 64px**. No hover-only UI. No text inputs anywhere in Kids Mode.
- Wake lock: request a screen wake lock while the board is visible, and tolerate refusal.

### Visual direction
Carry over the look of the printed "Fall Earnings Board" Diego already likes: **warm autumn palette** (maple `#B8431F`, amber `#E08A1E`, gold `#F2C14E`, moss `#6B7A2E`, plum `#7A3B4A` on paper `#FBF3E4`). Chunky rounded display type (e.g. **Fraunces** for titles, **Nunito** for everything else, both from Google Fonts). Each card has a colored stripe on its left edge and a **price tag chip** in the top right. Make the palette a **theme token set** so later households can choose seasonal themes (Fall, Winter, Spring, Summer, Plain). Build Fall first.

### Screens

**K1. Who's here? (kid picker)**
- Big round avatars (photo, or the first letter on the kid's color) and a name under each. 2–4 kids fit on one row.
- Under each avatar: the kid's **balance** in large type.
- Small, unobtrusive **"Parent"** button in a corner (lock icon), which starts the admin unlock (§7).

**K2. My board** (after tapping a kid)
- **Header:** avatar and name on the left. On the right, a big **balance** ("$42.00 in my bank"), and under it, smaller, **"$12.00 waiting for check"**. A **Back** button to the picker.
- **Horizontal sections, one row each, scrolling vertically:**
  1. **✨ New!**: cards that just appeared (see §5). Sparkle badge and a gentle pop-in animation.
  2. **🛠 Needs fixing**: sent-back cards with the parent's comment in a speech bubble and a **"Fixed it!"** button. Shown only when there are any. This row sits near the top because it's the most important.
  3. **Ready to do**: every other available card.
  4. **⏳ Waiting for check**: this kid's pending submissions (greyed, with "Mom/Dad will check").
  5. **🌙 Coming back soon**: chores in cooldown or starting soon, with **"Back in 3 days"** / **"Back Monday"**, greyed and not tappable. It shows kids that chores return, and it's the "appearing and disappearing" section Diego asked for.
- **Card anatomy:** emoji or icon, title (large), 1–2 line description, price chip ("$5" or "$5 / floor"), and a colored stripe. Tapping the card opens the confirm sheet.
- **Confirm sheet:** big card preview. If `max_quantity > 1`, a **big +/− stepper** ("How many floors? 2") that shows the total live ("= $10"). Then a huge **"I did it! ✅"** button and a smaller "Oops, not yet".
- On submit: **confetti**, a friendly sound (only after a tap, muted by default and toggleable in settings), the card animates into "Waiting for check", and a toast says **"Sent to Mom/Dad for checking!"**
- **Idle:** after `kid_idle_seconds` (90s) with no touches, return to the picker. That way the next kid doesn't submit under a sibling's name.
- **My money** tab or button (optional in v1, required in v2): a simple list of recent earnings and payouts with a savings progress bar toward a goal the parent sets.

### Kid-proofing
- No double submits (disable the button and use an idempotency key per tap).
- Optimistic UI, rolled back if the server says the chore is already taken (for example, a sibling just submitted it). Then show "Oh! Someone already did this one."
- Realtime: when the parent approves or sends back a submission, the board updates live without a refresh.

---

## 7. Modes, auth and the kitchen tablet

### Parent auth
- Supabase Auth, **email + password**. Add magic link as well if cheap. Password reset flow.
- Sign-up creates the account, then goes to onboarding (§9).

### Putting a tablet in Kids Mode
1. A parent logs in on the tablet and goes to **Admin → Devices → "Use this device as the kids' tablet"** (also offered at the end of onboarding and as a header button **"Switch to Kids Mode"**).
2. The server creates a `devices` row with a random 32-byte token, stores **only its hash**, and sets the raw token in an **httpOnly, Secure, SameSite=Lax cookie `kiosk_token`** (1-year expiry, refreshed on use).
3. The server **signs the parent out** on that device (clears the Supabase session). The tablet now shows K1.
4. The kids open it from the home-screen icon, with no login ever.

### Getting into Admin from the tablet
- Tap **Parent** on K1. A full-screen sheet asks for **email + password**. It prefills the last email used on the device and keeps it editable.
- Offer an optional **parent PIN** (4–6 digits, set in Admin → Settings, stored hashed per member) as a faster unlock. If a PIN is set, the sheet shows a PIN pad with "Use password instead". The PIN only unlocks a real parent session when the device is a registered kiosk for that household, and it rate-limits: 5 tries, then a 5-minute lockout.
- On success, Admin Mode starts on that device.

### Admin Mode auto-timeout
- Store `admin_last_activity` (client) and enforce it on the server with a short-lived signed cookie `admin_mode_until` that is **renewed on each admin request**.
- After **`admin_timeout_minutes` (default 30) of inactivity**, the app signs the parent out and returns to Kids Mode automatically. Only do this if the device has a `kiosk_token`. On a parent's own phone or laptop with no kiosk token, the normal session rules apply.
- A visible **"Back to Kids Mode"** button is always in the admin header on a kiosk device.
- A countdown banner appears 60 seconds before the timeout: "Switching back to Kids Mode in 60s — Stay in Admin".

### Devices page
- List devices with name, last seen, and a **Revoke** button. Revoking immediately invalidates the token, and that tablet shows "This tablet was disconnected. Ask a parent to set it up again."

### Parents on their own phones
- A parent can log in from any phone to approve chores. The admin pages must be **responsive** (phone portrait) as well as tablet landscape.

---

## 8. Admin experience

Navigation, as a sidebar on tablet and bottom tabs on phone: **Approvals · Chores · Kids · Payouts · History · Settings** (Settings includes **Billing**, §19). Approvals is the home screen and shows a count badge.

**A1. Approvals (home)**
- A queue of `pending` submissions, oldest first. Each shows the kid's avatar and name, chore title, quantity × price = amount, and "3 hours ago".
- Buttons: **Approve** (green, big), **Send back** (opens a comment box with quick-pick chips like "Missed a spot", "Not finished", "Please redo carefully", plus free text), and **Reject** (tucked in a menu, needs a reason).
- **Approve all** for a kid, with a confirm step built into the page (no browser `confirm()`).
- Quantity can be edited before approving (e.g. the kid said 3 floors, parent approves 2).
- **Approve creates the ledger `earning` in one transaction**, plus a `match` row when `savings_match_percent > 0`. Use a Postgres function `approve_submission(submission_id, quantity, comment)` so it's atomic and idempotent.
- Realtime: new submissions appear live, with an optional sound.

**A2. Chores**
- A grid of the same cards the kids see (WYSIWYG), plus an "Add chore" card.
- A search/filter row: Active / Paused / Seasonal / All.
- **Inline quick edit** of the price right on the card (tap the price chip, type or step, save).
- **Pause/resume** toggle per card (sets `active`). Paused cards disappear for the kids.
- Drag to reorder (`sort_order`).
- Full editor (side sheet): title, description, emoji, color, price, unit label and max quantity ("per floor", max 3), repeat (Once / Daily / Weekly / Every N days, with N picker presets 3, 7, 14, 30), scope (Whole house / Each kid separately), assigned kids (All or a pick list), seasonal window, a note for kids, and whether it requires approval.
- **Add from templates** button that opens the template picker (§9) at any time.
- **Duplicate** a chore.
- **Delete**: allowed only when there are no submissions. Otherwise offer "Pause" instead and explain why.
- Show each card's **live status** for the parent: "Available", "Waiting for your check", "Back in 5 days (last done by Mateo on Sep 20)".

**A3. Kids**
- Add, edit and archive. Fields: name (required), photo (optional; upload from the tablet camera roll or file picker, cropped to a circle client-side, stored in Supabase Storage `avatars/{household_id}/{kid_id}.webp`), color, order.
- Each kid's page shows the balance, pending amount, recent submissions, a ledger history, and a **"Manual adjustment"** action (± amount + note; e.g. a bonus or a correction).

**A4. Payouts**
- Choose a kid, see their current balance, enter an amount (defaults to the full balance, can't exceed it unless "Allow negative" is ticked), pick a method (Cash / Bank deposit / Savings account / Other), and add a note.
- Creates a `payout` ledger row (negative amount).
- A payout history list per kid, with totals this month and this year.

**A5. History**
- A combined feed of submissions and ledger events, filterable by kid, chore, type and date range. **Export CSV.**

**A6. Settings**
- Household name, timezone, currency, language (EN/FR), week start day.
- Admin timeout minutes (default 30), kid idle seconds (default 90).
- Savings match % (0 = off).
- Parent PIN (per member).
- Members: invite a co-parent by email (they get owner/parent role), remove members.
- Theme (Fall for now).
- Devices (see §7).
- Danger zone: delete household (owner only; type the name to confirm).

---

## 9. Onboarding: new household in under 3 minutes

This is also the future SaaS sign-up flow, so keep it smooth.

1. **Create account** (email, password, accept Terms and Privacy Policy). **No credit card needed.** This starts a **14-day free trial** (a `subscriptions` row with `plan='trial'` and `trial_ends_at = now() + 14 days`).
2. **Name your home** ("Czul family"), with timezone auto-detected from the browser and currency auto-picked from the locale (both editable).
3. **Add your kids**: a name field and an optional photo, with "+ Add another". At least one kid is required.
4. **Pick your chores**: show **all templates pre-selected** as cards in the kid style, grouped by category (Car & Garage, Outdoor, Kitchen, Cleaning, Laundry, Organizing). The parent can:
   - unselect any card (tap to toggle),
   - edit the price inline on each card,
   - change the repeat inline (a small chip dropdown),
   - use "Select all / none" per category.
5. **Set up this tablet?** Offer "Use this device as the kids' tablet" (switches to Kids Mode) or "I'll do it later" (goes to Admin).

Templates are **copied** into `chores` (with `template_key` kept for analytics). Editing a household chore never changes the template.

---

## 10. Starter templates (seed data)

Seed `chore_templates` with these. They come from the household's real list. Prices are CAD. Terrace and barbecue prices are proposals; see §16.

| key | Title | Description (kid-facing) | Price | Unit / max | Repeat | Scope | Category |
|---|---|---|---|---|---|---|---|
| car_mats | Car mats & vacuum | Pull out every car mat, vacuum the car, clean the mats perfectly and put them back. | $5 | — | every 14 days | household | Car & Garage |
| summer_wrapup | Summer wrap-up | Bring the summer clothes down, carry the outdoor furniture in front of the cabin, and line up everything that goes in the garage in front of the garage. | $10 | — | once (season: fall) | household | Outdoor |
| garden_closedown | Garden close-down | Pull the finished plants, empty the pots, stack them in the shed. | $8 | — | once (season: fall) | household | Outdoor |
| garage_sweep | Garage sweep | Sweep and clean every floor area of the garage. | $5 | — | every 14 days | household | Car & Garage |
| shoe_station | Entryway shoe station | Organize every single shoe and boot in the entryway, lined up perfectly. | $2 | — | weekly | household | Organizing |
| closet_swap | Winter closet swap | Box summer clothes, bring out coats and boots, put outgrown things in the donate bag. | $6 | — | once (season: fall) | per_kid | Organizing |
| bathroom_deep | Bathroom deep clean | Mirror, sink, toilet, floor, fresh towels stocked. | $7 | — | weekly | household | Cleaning |
| bin_boss | Garbage boss | Empty every garbage bin in the house and bring the garbage and recycling out to the street. | $5 | — | weekly | household | Cleaning |
| laundry | Laundry manager | Do the complete laundry: sort, wash, dry, fold and deliver to every room. | $5 | — | weekly | household | Laundry |
| baseboards | Baseboards | Take a wet towel and clean every single baseboard on the floor. | $5 | per floor / 3 | every 14 days | household | Cleaning |
| kitchen_cabinets | Kitchen cabinets | Clean every single kitchen cabinet, doors and handles. | $5 | — | every 14 days | household | Kitchen |
| basement_toys | Basement toy audit | Go through the whole basement, decide which toys we give away and which we keep, and organize everything by category. | $6 | — | every 90 days | household | Organizing |
| sous_chef | Sous-chef night | Help prep and cook one dinner start to finish, then wipe the counters. | $5 | — | weekly | per_kid | Kitchen |
| switches | Switches, handles & remotes | Clean every light switch, door handle and remote with cleaner. | $5 | per floor / 3 | weekly | household | Cleaning |
| terrace | Clean the terrace 100% | Sweep, wash and clear the whole terrace until it's spotless. Furniture wiped, nothing left lying around. | $10 | — | every 14 days | household | Outdoor |
| barbecue | Clean the barbecue 100% | Scrub the grill grates, empty the grease tray, wipe the outside and the side tables. With a parent nearby, and only when it's cold. | $8 | — | every 14 days | household | Outdoor |

Also seed **French** versions (`locale='fr'`) of every template (e.g. "Tapis d'auto et aspirateur", "Nettoyer la terrasse à 100 %", "Nettoyer le barbecue à 100 %").

**Diego's household:** Diego signs up through the normal flow like any customer. Then a platform admin sets his household to `plan='comp'` (complimentary, never billed) from the platform console (§20). `scripts/make-platform-admin.ts <email>` inserts the first `platform_admins` row.

---

## 11. Routes

```
/                         marketing landing page → "Start free trial" / "Log in"
/pricing                  plans, monthly/yearly toggle, FAQ
/terms  /privacy          legal pages (see §19.6)
/login  /signup  /reset
/onboarding/[step]
/kids                     Kids Mode: picker (requires kiosk_token)
/kids/[kidId]             Kids Mode: board
/admin                    → /admin/approvals
/admin/approvals
/admin/chores  /admin/chores/[id]
/admin/kids    /admin/kids/[id]
/admin/payouts
/admin/history
/admin/settings  /admin/settings/devices  /admin/settings/members
/admin/settings/billing   plan, trial days left, Upgrade → Stripe Checkout, Manage → Customer Portal
/invite/[token]
/platform                 platform owner console (platform_admins only, §20)
/api/kiosk/*              kiosk-only route handlers (whitelisted operations)
/api/stripe/checkout      creates a Checkout Session (POST, parent session)
/api/stripe/portal        creates a Customer Portal session (POST, parent session)
/api/stripe/webhook       Stripe webhook (raw body, signature verified)
```

Root routing: when the device has a valid `kiosk_token` and no active admin session, go to `/kids`. With a parent session, go to `/admin`. Otherwise go to `/`.

Middleware: protect `/admin/*` (parent session and membership required), protect `/kids/*` (valid kiosk token required), and enforce the admin-mode timeout on kiosk devices.

---

## 12. Project structure

```
app/
  (marketing)/page.tsx
  (auth)/login, signup, reset
  onboarding/
  kids/  [kidId]/
  admin/ approvals, chores, kids, payouts, history, settings
  api/kiosk/
components/
  kid/   ChoreCard, KidAvatar, BalanceBadge, ConfirmSheet, SectionRow, Confetti
  admin/ ApprovalItem, ChoreEditor, TemplatePicker, PayoutForm, ...
  ui/
lib/
  supabase/ server.ts, client.ts, admin.ts (service role, server-only)
  kiosk/    auth.ts, operations.ts   ← the whitelist
  schedule/ getChoreState.ts (+ tests)
  money/    format.ts, ledger.ts (+ tests)
  i18n/     en.json, fr.json
supabase/
  migrations/*.sql
  seed/templates.sql
scripts/seed-diego.ts
public/manifest.webmanifest, icons/
```

---

## 13. Deployment

1. Supabase project (region **ca-central-1** so data stays in Canada). Run the migrations and template seed.
2. Storage bucket `avatars` (private). Serve through signed URLs, or a public-read policy scoped to the path. Signed URLs are preferred.
3. Vercel project linked to the GitHub repo. Set these env vars in Vercel (Production and Preview separately). **Never commit values.** Locally they live in `.env.local`, which is gitignored. Diego has a filled-in `.env.local` to drop into the project root.

| Variable | Where it comes from | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API | **no** |
| `SUPABASE_DB_PASSWORD` | Set when the Supabase project was created (used by `supabase db push` / CLI only) | **no** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API keys (`pk_test_…` in Preview/dev, `pk_live_…` in Production) | yes |
| `STRIPE_SECRET_KEY` | Stripe API keys (`sk_test_…` / `sk_live_…`) | **no** |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → endpoint signing secret (`whsec_…`); a different one per environment | **no** |
| `STRIPE_PRICE_FAMILY_MONTHLY`, `STRIPE_PRICE_FAMILY_YEARLY`, `STRIPE_PRICE_FAMILY_PLUS_MONTHLY`, `STRIPE_PRICE_FAMILY_PLUS_YEARLY` | Price IDs created by `scripts/stripe-setup.ts` (§19.2) | **no** |
| `KIOSK_COOKIE_SECRET`, `ADMIN_MODE_SECRET` | `openssl rand -hex 32` | **no** |
| `RESEND_API_KEY` | Resend (optional in v1) | **no** |
| `APP_URL` | `https://kids.diegoczul.com` | — |

Diego's existing Stripe env names map like this: `STRIPE_KEY` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET` → `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` stays the same. **Use the sandbox (test) keys everywhere until Diego explicitly says to go live.** Live keys go only into Vercel Production env vars, never into a file.
4. Domain: add `kids.diegoczul.com` in Vercel, then create a **CNAME `kids` → `cname.vercel-dns.com`** at the DNS provider.
5. Supabase Auth: set the Site URL and redirect URLs to the production domain and to `localhost:3000`.
6. Preview deployments use a separate Supabase project (or branch) so production data is never touched.

---

## 14. Build phases (in order, with a working deploy after each)

1. **Foundation**: scaffold, Tailwind theme tokens (Fall), Supabase clients, migrations + RLS + template seed, auth pages, deploy to Vercel on the domain.
2. **Onboarding**: household, kids (with photo upload), template picker with inline edit → chores.
3. **Scheduling engine**: `getChoreState` with full unit tests (every repeat kind, scope, sent back, rejected, seasonal, timezone and DST edges).
4. **Kiosk**: device registration, cookie, kiosk API whitelist, K1 picker, K2 board with all five sections, confirm sheet, quantity stepper, confetti, idle return, PWA manifest.
5. **Approvals + ledger**: `approve_submission` function, send back with comment, reject, realtime queue, balances, "Needs fixing" loop on the kid side.
6. **Admin**: chores CRUD with inline price edit, pause, reorder and duplicate; kids CRUD; payouts; manual adjustments; history + CSV.
7. **Mode switching**: Parent unlock sheet (password, optional PIN), 30-minute admin timeout with warning banner, devices page with revoke.
8. **Polish**: EN/FR i18n, sounds toggle, empty states ("All done for today! 🎉"), loading skeletons, error toasts, accessibility pass, Playwright E2E.
9. **Billing (§19)**: Stripe setup script, trial, Checkout, Customer Portal, webhook sync, plan limits, read-only lock when expired, billing settings page, Stripe Tax.
10. **Go-to-market (§19.6, §20)**: landing page, pricing page, Terms and Privacy, platform owner console, trial emails, member invites.

---

## 15. Acceptance criteria

- [ ] A new parent can sign up, create a home, add 2 kids and 10 template chores, and put the tablet in Kids Mode **in under 3 minutes**.
- [ ] On the tablet, a kid taps their face, taps a card, taps "I did it!", and the card disappears from Ready, shows in Waiting, and confetti plays. No text input at any point.
- [ ] Siblings: a `household`-scope card submitted by kid A disappears for kid B immediately (realtime).
- [ ] A parent on their phone sees the submission live, sends it back with "Missed a spot", and the kid's board shows it under **Needs fixing** with that comment. "Fixed it!" returns it to the queue.
- [ ] Approve adds the money to the kid's balance (and the match, if on). The balance on K1 and K2 updates live.
- [ ] Baseboards (every 14 days, per floor ×3): a kid submits 2 floors, which gives $10 pending. After approval the card is gone and appears in **Coming back soon** as "Back in 14 days". On day 14 at local midnight it reappears under **✨ New!**
- [ ] A payout of $20 reduces the balance by $20 and shows in the kid's history.
- [ ] From Kids Mode, Parent → password → Admin works. After 30 minutes idle, the tablet returns to Kids Mode by itself (with the 60-second warning).
- [ ] A revoked device loses access immediately.
- [ ] Household A can never read household B's data. RLS tests prove it (write them).
- [ ] Ledger rows can't be updated or deleted by anyone.
- [ ] Every screen works in iPad landscape (1024×768 minimum) and admin works in phone portrait.
- [ ] Lighthouse PWA installable; home-screen launch is full-screen and landscape.
- [ ] A stranger can go from the landing page to a trial household with no card, then upgrade with Stripe test card `4242 4242 4242 4242`. The webhook flips the household to `family`/`active` within seconds.
- [ ] The Customer Portal lets a parent change plan, update their card and cancel. After cancelling, the household stays active until the period ends, then becomes read-only.
- [ ] An expired trial or unpaid subscription locks admin editing (a banner and Upgrade button). **The kids' tablet keeps working in read-only mode**: kids can see balances but can't submit, and they see "Ask a parent to check the app".
- [ ] Replaying the same webhook event twice changes nothing (idempotent via `stripe_events`).
- [ ] Plan limits are enforced on the server (e.g. adding a 4th kid on Family shows the upgrade prompt).

---

## 16. Open questions and the defaults to use now

| # | Question | Default (build this unless Diego says otherwise) |
|---|---|---|
| 1 | Exact domain spelling | `kids.diegoczul.com` |
| 2 | Terrace and barbecue prices | Terrace **$10**, barbecue **$8**, both every 14 days |
| 3 | Should a sent-back chore still count toward cooldown? | Yes, from the first tap (prevents farming) |
| 4 | Household vs per-kid cooldown default | Household for house chores; per-kid for personal ones (closet, sous-chef) |
| 5 | Unlock with password only, or also a PIN? | Password always works; PIN is optional in Settings |
| 6 | Language | English and French both built in; household picks the default |
| 7 | Photo proof ("take a picture of the clean terrace") | **Not in v1.** Design the submission table so an optional `photo_path` can be added in v2 |
| 8 | Parent notifications when a kid submits | v1: realtime in-app badge. v2: web push / email digest |
| 9 | Savings match | Built in, default **0% (off)**; Diego can set e.g. 50% |
| 10 | Kid savings goals ("Saving for: Nintendo game $60") | v2, but design the kid header to have room for a progress bar |
| 11 | Plan prices | Family **$4.99 CAD/mo or $49/yr**; Family Plus **$7.99/mo or $79/yr** (§19.1). Diego to confirm |
| 12 | Co-parent access (e.g. Cami) | Invite by email from Settings → Members |
| 13 | Which legal entity sells the subscriptions (Stripe account, Terms, invoices) | Whatever entity owns the Stripe account; show its legal name in the footer, Terms and invoices from a single `LEGAL_ENTITY_NAME` config |
| 14 | Product name / own domain for the SaaS | Use a placeholder brand **"Chore Board"** in one config file (`lib/brand.ts`) so it can be renamed and moved to its own domain later |

---

## 17. Non-goals for v1

Native apps · photo proof · push notifications · multiple households per device · chore streaks and badges (good v2 idea: "5 chores this week 🔥") · kid logins on their own phones · coupons/referral program (Stripe supports promotion codes; just enable "allow promotion codes" in Checkout for now).

---

## 18. Quality bar

- TypeScript strict, no `any` in `lib/`.
- The scheduling and ledger logic has 100% branch coverage.
- Every mutation goes through a Server Action or Route Handler that re-checks household membership (or the kiosk token) on the server. Never trust the client for `household_id`.
- Money is formatted with `Intl.NumberFormat(locale, { style: 'currency', currency })`.
- Accessible: visible focus rings, semantic buttons, `prefers-reduced-motion` turns off confetti and pop animations.
- Commit per phase with clear messages. Keep a `README.md` with local setup (`pnpm i`, `supabase start`, `pnpm dev`) and deploy steps.

---

## 19. Billing and subscriptions (Stripe)

### 19.1 Plans

| Plan | Price (CAD) | Limits | Notes |
|---|---|---|---|
| **Trial** | free, 14 days | Family Plus limits | Starts at sign-up, no card |
| **Family** | $4.99/mo or $49/yr | 1 household, up to **3 kids**, unlimited chores, 2 tablets, 2 parents | Main plan |
| **Family Plus** | $7.99/mo or $79/yr | up to **8 kids**, 5 tablets, 4 parents, CSV export, savings match, custom themes | For big or blended families |
| **Comp** | free | Family Plus limits | Set only by a platform admin (Diego's own home, friends, testers) |

Limits live in one place (`lib/billing/plans.ts`) and are enforced on the **server** in every mutation that creates kids, devices or members. The UI shows a friendly upgrade prompt, never a raw error.

### 19.2 Stripe setup (script, idempotent)

`scripts/stripe-setup.ts` uses `STRIPE_SECRET_KEY` to create (or find, by `lookup_key`) these objects:
- Product **"Chore Board Family"** with prices `family_monthly` and `family_yearly`.
- Product **"Chore Board Family Plus"** with prices `family_plus_monthly` and `family_plus_yearly`.
- All prices are recurring, in CAD, `tax_behavior: 'exclusive'`.
- It prints the price IDs to paste into the env vars.

Run it once against test mode, and again against live mode when going live. In code, prefer lookup keys (`stripe.prices.list({ lookup_keys })`) so the env price IDs are only a cache.

Stripe dashboard settings, which the script's README should list as a checklist for Diego:
- **Stripe Tax** on, with registrations for GST/HST and QST (Quebec). Checkout uses `automatic_tax: { enabled: true }` and collects the billing address.
- **Customer Portal** configured: allow plan switching between Family and Family Plus (monthly/yearly), card updates, invoice history, and cancellation at period end.
- Branding: logo and colors matching the Fall theme.
- Webhook endpoints: `https://kids.diegoczul.com/api/stripe/webhook` (live) and the Vercel preview URL or `stripe listen` (test).

### 19.3 Flows

- **Upgrade:** Billing page → pick a plan → `POST /api/stripe/checkout` → the server creates the Stripe Customer if one doesn't exist (`metadata.household_id`), then a Checkout Session (`mode: 'subscription'`, `client_reference_id = household_id`, `subscription_data.metadata.household_id`, `allow_promotion_codes: true`, `automatic_tax`, success URL `/admin/settings/billing?success=1`) → redirect.
  - If upgrading during a trial, pass `subscription_data.trial_end = trial_ends_at` so they don't lose their remaining free days.
- **Manage:** "Manage billing" → `POST /api/stripe/portal` → redirect to the Customer Portal.
- **Only owners** can see or change billing. The `parent` role sees the plan name only.

### 19.4 Webhook (the source of truth)

`/api/stripe/webhook` (Node runtime, reads the **raw body**, verifies with `stripe.webhooks.constructEvent` and `STRIPE_WEBHOOK_SECRET`):
1. Insert `event.id` into `stripe_events`. If it already exists, return 200 immediately (idempotent).
2. Handle:
   - `checkout.session.completed` → link `stripe_customer_id` / `stripe_subscription_id` to the household.
   - `customer.subscription.created` / `updated` / `deleted` → upsert `subscriptions` (plan from price lookup key, `status`, `current_period_end`, `cancel_at_period_end`).
   - `invoice.payment_failed` → status `past_due`, send an email to owners.
   - `invoice.paid` → clear the past-due banner.
3. Always re-fetch the subscription from Stripe (`stripe.subscriptions.retrieve`) instead of trusting the event order.
4. Mark `processed_at`. Return 200. On error return 500, so Stripe retries.

Never grant or remove access based on the redirect back from Checkout. Only the webhook changes `subscriptions`.

### 19.5 Access rules

A single helper, `getHouseholdAccess(householdId)`, returns `'full' | 'read_only'`:
- `full`: `comp`; `trialing` with `trial_ends_at > now`; `active`; `past_due` within a **7-day grace period**.
- `read_only`: everything else (trial expired, canceled after period end, unpaid).
- In **read-only** mode:
  - **Admin:** everything is visible, including history, balances and CSV export (their data is always theirs). Creating or editing chores, approving, payouts and adding kids are disabled, with an **Upgrade** banner.
  - **Kids tablet:** balances and cards are visible, but submitting is disabled, with a gentle message: "The chore board is paused. Ask a parent!"
- **Data is never deleted** because a subscription lapsed. The owner can delete the household themselves (Settings → Danger zone). Canceled households with no activity for 12 months can be purged by a scheduled job, with a warning email sent 30 days before.

Trial emails (Resend, or skip in v1 if no key): day 11 "3 days left", day 14 "trial ended — your data is safe", and on payment failure.

### 19.6 Public site and legal (required to sell)

- **Landing page `/`:** hero with a screenshot or mockup of the kids' board on a tablet, a "How it works" section in 3 steps (Add kids → Pick chores → Kids tap, you approve, they save), features, pricing preview, FAQ, and a "Start free trial" call to action. Same Fall visual language.
- **`/pricing`:** monthly/yearly toggle (yearly shows "2 months free"), prices shown in CAD with "+ tax".
- **`/terms` and `/privacy`:** placeholder legal text clearly marked for review by a lawyer before launch. The privacy page must say that **kids have no accounts and no email**: the only kid data is a first name, an optional photo and chore history, entered and controlled by the parent. It must also say that data is stored in Canada (Supabase ca-central-1), that parents can export or delete everything at any time, and that there's no advertising and no selling of data. (This is relevant to Quebec Law 25, PIPEDA and COPPA.)
- Footer: legal entity name, contact email, Terms, Privacy.
- A cookie notice is not needed as long as there are no analytics or ad cookies. If analytics are added later, use a cookieless tool (e.g. Vercel Analytics or Plausible).

---

## 20. Platform owner console (`/platform`)

Only users in `platform_admins` can see it (checked on the server). Diego uses it to run the business:
- **KPIs:** total households, active trials, paying households by plan, MRR (from `subscriptions` × price), trial→paid conversion, churn this month.
- **Households table:** name, owner email, plan, status, trial end, kids count, last activity, created date. Searchable.
- **Household actions:** set **comp** plan, extend trial (+7/+14 days), open that household in Stripe, and view (read-only) its settings for support. **No impersonation of kid data editing.**
- Every action writes to an `audit_log` table (`actor`, `action`, `household_id`, `details jsonb`, `created_at`).

---

## 21. Secrets handling (for the coding agent)

- The real values are in Diego's **`.env.local`**. Copy it into the project root. `.gitignore` must include `.env*` except `.env.example`.
- Commit an **`.env.example`** with every variable name from §13 and empty values.
- Never print secrets in logs, never pass them to client components, and never paste them into code, tests, READMEs or commit messages.
- Check before every push: `git grep -nE "sk_(live|test)_|whsec_|service_role"` must return nothing.
