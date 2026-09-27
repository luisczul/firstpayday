# Owner feedback checklist — 2026-09-26

Every observation the owner gave in this round, with what "working" means.
Verify each one on **production (https://firstpayday.app)** after deploy.

| # | Observation (owner's words, paraphrased) | Expected behaviour on production | Where |
|---|---|---|---|
| 1 | Kids' board: cards scroll **vertically**, not in horizontal rows | Board sections are grids that wrap and scroll down; no sideways scrolling rows | Tablet → kid board |
| 2 | Keep the **"New!"** section | New chores still appear first under "✨ New!" | Kid board |
| 3 | **Categories as menu buttons** at the top (e.g. tap "Garage") | Sticky pill menu: 🌈 All + only categories that have cards; tapping one filters the board to that category; "All" groups ready cards under category headings | Kid board |
| 4 | **Record which tablet** each submission was made on; see most-used tablets | Settings → Tablets shows per-tablet counts (total / this week / 30 days / $) and "Mostly <kid>"; History has a "Tablet" column and CSV `tablet` field | Admin |
| 5 | **Reverse an approval** after approving | Approvals → "Recently approved" → Undo… → "↩ Reverse (no pay)" with a required note; money comes back out; confirmation message stays visible | Admin |
| 6 | **Ask for a revision** after approving, with a comment | Undo… → "🛠 Ask for a revision" (chips + note); money taken back until re-approved | Admin |
| 7 | Kid gets a **notification** that a revision is needed and sees what it is | Kid picker shows a bouncing "🛠 N" badge; board shows a plum banner "You have N to fix!" with the comment; card in "Needs fixing" shows 💬 comment; "Fixed it!" resubmits | Tablet |
| 8 | **Language per kid** (parent in English, a kid in French) | Kid page → "Board language" (Same as household / English / Français); that kid's board screens + chore text are in that language; parent admin stays in household language | Admin + tablet |
| 9 | **Auto-translate edits**: save in English → French saved too; write in French → English saved too | Saving a chore calls Claude (ANTHROPIC_KEY) and stores both languages; parent's copy is in the household language; a French kid sees the French text | Admin chore editor + tablet |
| 10 | A **"Translate" menu item** next to Edit / Pause, to re-translate after lots of edits | Each chore has "🌐 Translate"; header has "🌐 Translate all"; shows "Translated N of M" | Admin → Chores |
| 11 | **Quantity field** can't be changed from 1 to 2 (becomes 12) | Max quantity is a − [n] + stepper; the box can be cleared and retyped; +/− work | Chore editor |
| 12 | **"Every N days"** can't be changed from 14/30 to 60/90 | Days is a stepper too; can clear and type 60; preset chips still work | Chore editor |
| 13 | **All number boxes** have that problem | Kid "Order", settings admin timeout / kid idle seconds / savings match are clearable and retypeable | Admin |
| 14 | **Empty value must not save** — say a value is required | Save disabled / error "Enter a max quantity…" / "Fill in every number before saving." when a number box is empty | Admin |
| 15 | Must be able to **choose a category when editing** a chore (couldn't see it) | Chore editor shows "Category" pills right under Description | Chore editor |
| 16 | **Bonus tip on approval** (+$1, +$2 for a great job) | Each pending card has "Add a tip" chips (+$0.50 / +$1 / +$2 / Other…); button reads "Approve + $1 tip"; kid's bank gets price + tip; kid sees "🌟 Bonus: …"; undo takes the tip back too | Approvals |
| 17 | **Icon drives the stripe color** — no stripe color picker; a color per icon | No "Stripe color" field; each icon has its own color (e.g. 🚗 red, 🧺 lavender, 🪴 green) on tablet and admin cards; icon buttons tinted | Chore editor + cards |
| 18 | Card layout: **icon left and price right on the same line** | Top row of every card: icon on the left, price chip on the right; title below; no big gap | Admin + tablet cards |
| 19 | **Sort by price** ascending / descending on the kids' view | "💰 Sort by $" button in the kid board menu cycles: parent order → $ → $$$ → $$$ → $ | Kid board |
| 20 | **Email all parents** when a kid finishes a chore ("ready for review") | Every parent (with the preference on) gets an email with kid, chore, amount; throttled so a burst of taps doesn't spam | Email (Resend) |
| 21 | Email button **logs the parent in automatically** (no password) | "Review now" is a one-time, 1-hour sign-in link that lands on /admin/approvals signed in | Email → site |
| 22 | Emojis / French accents were garbled in cards | All template emojis and French text render correctly (fixed earlier; re-check) | Tablet + admin |
| 23 | Orange focus ring offset on price edit in onboarding | Focus ring hugs the field shape (fixed earlier; re-check) | Onboarding |
| 24 | Timezone chopped / wrong in onboarding | Full-width readable timezone select; the chosen zone is saved (fixed earlier; re-check) | Onboarding |
| 25 | www.firstpayday.app redirects to firstpayday.app | 308 redirect to the apex | DNS / Vercel |
| 26 | **French must fully work** ("imperative") | (a) A kid set to Français: picker/board/buttons/toasts/categories/sort/revision banner/bonus label all in French; starter chores in French; custom chores the parent wrote in English appear in French. (b) Parent writes a chore **in French** → it is saved in English for the parent (English household) and in French for the French kid. (c) A **French household** (Settings → Language: Français): kid screens, starter chores and emails in French; an English kid in that home still sees English (the parent admin panel itself is English-only today). (d) "🌐 Translate all" fixes any chore still missing French | Everywhere |
| 27 | **No payment restrictions for now** — any number of kids and chores | Adding a 2nd…10th kid never asks for payment; the board never goes read-only; no trial countdown; Billing page says "Free for now 🎁"; no Stripe charges (switch: BILLING_ENABLED + SQL billing_enforced()) | Admin |
| 28 | **Track kid check-ins** (tapping their name on the tablet) | Each tap on a kid's name is recorded; the parent sees check-ins count, last check-in time, and usage stats per kid | Tablet → Admin |
| 29 | **Weekly report email** to parents | Covers: chores done and earned, check-ins per kid, activity (submissions, approvals, send-backs, tips, payouts), and emails sent to the parents that week | Email |
| 30 | Weekly report **Saturday 12:00 by default**, day and time changeable in settings (weekly only) | Settings shows "Weekly report: Saturday at 12:00" with day and hour pickers; the report arrives at that local time in the household timezone | Admin + email |
| 31 | **Search box on the kids' board**, in the kid's language | Big input + "🔍 Search" / "🔍 Chercher" button; filters cards live by title and description in the kid's board language, ignoring accents; ✕ clears; "Nothing found" / "Rien trouvé" message | Kid board |
| 32 | **Native iOS + Android apps** (next phase, after everything above is 100%) | Owner will provide two GitHub repos; must satisfy Apple App Review (no bare web-view wrapper, guideline 4.2) | — |
| 33 | **Spanish and Portuguese** as full languages, templates translated | Household and per-kid language pickers offer English / Français / Español / Português; kid screens, starter chores, categories, emails and auto-translation cover all four | Everywhere |
| 34 | **Template prices** follow the owner's edited amounts; kid-sized ($1–$2, not $5–$10) | New homes get the owner's prices where he set them (e.g. Garbage boss $1, Car mats $2, Summer wrap-up $5) and $1–$2 for the rest; existing chores unchanged | Onboarding / Add from templates |
| 35 | **Cents** (e.g. make the bed 50¢) | Prices accept 0.50 and .50; cards show $0.50; new "Make your bed" template at 50¢ daily per kid | Chore editor, templates, tablet |
| 36 | **Why it matters** on the home page and signup | Section "Why it matters for your kids": value of money, responsibility, saving, how the world works (home page + under the signup form) | Public site |
| 37 | **Crop / zoom the kid photo** | Picking a photo opens "Adjust the photo": drag to move, pinch / slider / +− to zoom inside a circle; "Use photo" saves just that part | Kid page, onboarding |
| 38 | **Optional family tax** (off by default), offered on the last onboarding screen | Parent sets a %; payouts withhold that tax; kid sees total earned, tax accrued, and why (it pays for things everyone shares: a family dinner, an ice-cream outing); parent sees why it teaches how taxes work | Onboarding, Settings, Payouts, kid bank |
| 39 | **Public site in all four languages**, with all four linked in the footer | Home, pricing, guides, terms and privacy available in English / Français / Español / Português; language links in the header or footer; hreflang for SEO | Public site |
| 40 | **Promotions**: parent sets start date/time and end date/time; every chore pays a bonus of **+$X** or **+N%** during it | Settings → Promotions: create / edit / end early; chores submitted inside the window get the bonus on approval (its own ledger line "🎉 Promotion: …", taken back if the approval is undone); kids see a banner with the countdown and the boosted price on cards; times are in the household timezone | Settings, Approvals, tablet |
| 41 | **Help & feedback** form for parents to message the owners (feature request, bug, question) | "💬 Help & feedback" in the sidebar and Settings tabs; pick a type, write, send; saved (shown under "Your messages") and emailed to info@firstpayday.app with reply-to set to the parent; listed later in the platform panel | Parent admin |
| 42 | **Everything is free** — no "first kid free", no prices shown; billing and trial code kept but hidden | Home, signup, FAQ, guides, terms say free; no Pricing link; /pricing redirects home; no Billing tab; no trial banners or trial emails; switch = BILLING_ENABLED + SQL billing_enforced() | Public site + admin |
| 43 | **Kids' tablet can't log out** and stays set up for a year | No log-out anywhere in Kids Mode; Parent button needs a PIN or password; tablet key cookie lasts 1 year and renews on every visit; only a parent can disconnect it (Settings → Tablets → Revoke); logging out of Admin Mode or opening the home page on the tablet returns to "Who's here?" | Tablet |
| 44 | **Chores with subtasks** (a checklist / routine), e.g. "Daily routine" $0.10 = make your bed + brush your teeth + read 15 min | Parent adds subtasks in the chore editor; the kid ticks each one on the tablet (progress saved across the day and across tablets, reset each period); "I did it!" only unlocks when all are ticked (also enforced on the server); 2 of 3 = no submission, no pay; then normal review → approved pays the amount; subtasks translated into the kid's language; three routine templates ($0.10, daily, per kid, in 4 languages): **Daily routine** with sections (🌅 Morning: brush your teeth, eat your breakfast, pack your backpack, clean your table, get ready for school · ☀️ Afternoon: eat your lunch, nap time, study time, exercise · 🌙 Evening: do the dishes, do your homework, playtime, take a bath, put on your pajamas), **Morning routine** (brush your teeth, eat your breakfast, pack your backpack, clean your table, get ready for school), **Evening routine** (do the dishes, do your homework, have some playtime, take a bath, put on your pajamas, story time) | Chore editor, tablet, approvals |
| 45 | **Cartoon avatars** instead of a photo | "Choose a picture" offers 12 buddies (🦊 🐼 🐸 🦁 🐯 🐨 🐵 🦄 🐶 🐱 🐰 🦖) or "📷 Use a photo"; shown on the tablet picker, board, approvals, payouts, kids list | Onboarding, kid page, tablet |
| 46 | **Parent side in 4 languages** | Onboarding and every admin screen, dialog, error message and invite email follow the household language (en/fr/es/pt) | Parent admin |
| 47 | **New chore → template or blank** | "+ New chore" first asks "📋 Start from a template" or "✏️ Start from blank"; a template opens the editor pre-filled (price, steps, translations) to tweak before saving; "✓ On your board" badge; bulk "Add from templates" still there | Admin → Chores |
| 48 | **Longer repeat options**: every 60 / 90 days, twice a year, yearly | Chore editor "Every N days" offers 3, 7, 14, 30, 60, 90 days, "Twice a year" (182 days) and "Yearly" (365 days); cards and lists say "Twice a year" / "Yearly" in all 4 languages | Chore editor |

## Final gate: full journeys in each language (required before "ready")
Run the whole product from zero **four times**: en, fr, es, pt-BR. Each run uses a monitored throwaway inbox and covers:
1. Public home page in that language.
2. Signup; confirmation email in that language.
3. Every onboarding screen, including the tax option on the last step.
4. Sample kids; starter chores, including the 3 routines.
5. Tablet setup; every kid screen in that language: categories, search, sort, subtasks, promo banner, bank sheet with tax.
6. Submit → "ready for review" email → approve with a tip → revision → fix → approve → payout with tax.
7. Weekly report email.

Each run fails on any untranslated text, broken accents, or "forever" wording, and its screenshots are reviewed by eye.
- **Locally:** local database and captured mailbox, same code as production. Account creation is allowed here.
- **Production:** public pages in all 4 languages, plus the logged-in journeys in a session the owner signs into (no automated account creation on the live site), including live Claude translation.

## Next phases (in order)

### Phase 2: Business control panel (/platform), before any AI features
The owner's business-wide dashboard, separate from the parent admin. Extends the existing app/platform.
- **Overview dashboard:** daily activity across all accounts (signups, active homes, check-ins, chores submitted / approved, money earned, emails sent), shown as charts by day plus totals (today / 7 days / 30 days).
- **Users:** every parent account (email, homes, role, signup date, last login, last activity), searchable and sortable.
- **Homes:** every household, with its number of kids, parents, tablets, chores and activity, and its language, timezone and plan.
- **Chores:** all chores across homes; chores per user and per home; chores done per kid; the most popular chores and templates.
- **Kids:** every kid with their home, check-ins, chores done, earnings and last activity.
- **Account drill-down:** open any home and see everything (kids, chores, submissions, ledger, tablets, activity timeline).
- **"View as" a parent or a kid:** see exactly what that parent's admin or that kid's board looks like. It starts read-only, shows a clear banner, and every use is written to an audit log.
- **Edit and help:** fix things for a customer (e.g. rename, archive or restore a kid, fix a chore, reverse a mistake, resend an email, comp a home), each logged.
- **Customer support inbox:** the Help & feedback messages (item 41) with status (new / read / done), reply by email, and links to that home.
- **Business tools:** billing switch status and plan overrides (comp), exports (CSV), and an audit log of every platform-admin action.

### Phase 3: AI features (after the control panel)
- **Educational** blog in the control panel: generate posts with the Anthropic key, seeded with 5–6 posts on why money education matters for kids. Public pages in 4 languages.
- **AI chore ideas** (v2): ✨ in the chore editor asks Claude for 5 ideas; Import each / Generate new ones.

### Phase 4: Native iOS + Android apps
Only when the owner says go (repos: luisczul/firstpayday_ios, luisczul/firstpayday_android).

## Verification status (2026-09-27, deployed commit 20c1d59)
- **Local production build:** full E2E suite 102 passed (2 Stripe tests skipped, billing off); unit tests 139; security (RLS) tests 56; typecheck and lint clean.
- **Four full journeys** (en / fr / es / pt-BR, each from zero, emails captured): all pass.
- **Production database:** migrations 8–20 applied after a rehearsal on a copy of production; the migrated schema is identical to a fresh one; the owner's data is intact.
- **Supabase auth emails:** confirm sign-up, magic link and reset password are in 4 languages.
- **Live public site:** items 25, 36, 39, the public half of 42, and the kiosk "not set up" message all pass. The 2 bugs found (kids-page language, login link language) are fixed and redeployed.
- **Left for the owner (signed in, production):**
  1. Turn on custom SMTP (Resend) in Supabase.
  2. Tap "🌐 Translate all" once.
  3. Run the logged-in journeys in his own session: checklist items 1–24, 26–31, 33–35, 37–48, and live Claude translation.
