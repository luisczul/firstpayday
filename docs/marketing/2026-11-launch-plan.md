# First Payday: launch marketing plan (November 2026 to April 2027)

Written 2026-11-09, the week the iOS build went to Apple. Everything here builds on the tracker from September 30 (`~/Github/Personal/firstpayday-marketing/First-Payday-Marketing-Plan.xlsx`: 142 Facebook groups ranked A/B/C, 150 creators with contacts, outreach templates in 4 languages, a 30-day content calendar, 8 demo clips). None of that has been started yet, so this plan says **what to do in which order**, adds what the tracker didn't cover (the app-store launch, store optimization, paid options with prices, Québec press, Reddit, Pinterest), and marks what I can build versus what only Diego can do.

Sources for every number are in the two research reports next to this file: `research-2026-11-09-channels-press.md` and `research-2026-11-09-store-traction.md`.

## 1. Where we stand

| | |
|---|---|
| Web | firstpayday.app, 4 languages, free. 3 SEO guide pages (chore chart app, allowance app, paid chores list). No analytics, no store badges, no referral loop, no press page. |
| Android | Live in production since Nov 4 (1.0.3), 10+ downloads. 1.0.4 (build 5) ready to upload. Not findable by search in the store yet (new listing). |
| iOS | 1.0 waiting for review with build 1; build 3 uploaded today. Not public yet. |
| Users | 9 homes since Sept 26 (mostly Diego, family and QA testers), 15 kids, 35 chores sent in, 1 active home this week. Baseline is zero. |
| Assets | Brand kit, store icons, 8 vertical demo clips + 2 montages with EN/FR captions, Facebook cover, YouTube banner. No Facebook Page, Instagram, TikTok or YouTube channel created yet. |

## 2. The goal

Keep the September goal but in phases:

- **Launch week (iOS live) to Dec 31:** 150 families signed up, 40 active homes (a kid tapped "I did it!" in the last 7 days), 25 store ratings across both stores, all channels created and posting.
- **Jan 1 to Feb 15 (the January peak):** 500 families, 150 active homes, first paid test done with a verdict.
- **By Apr 30:** 1,000 families, 300 active, 5 creator partnerships, 1 Québec press piece, a "Québec pocket money" data story in preparation for June.

"Active homes" is the number that matters. Signups without a kid tapping are noise.

## 3. Before launch day (this week and next)

These are the things that make every later channel work. I can build everything in **Product**; Diego does **Accounts**.

**Product (Claude)**
1. **Store badges and deep links on the site**: "Get it on Google Play" and "Download on the App Store" on the landing page, the footer and the 3 guide pages, in all 4 languages. Plus a short link `firstpayday.app/app` that sends phones to the right store and desktops to signup.
2. **Analytics**: Vercel Web Analytics (free, no cookie banner needed) with UTM tracking, so every post and pitch gets its own link (`?utm_source=reddit&utm_campaign=launch`). Weekly KPI pull from Supabase (signups, active homes, kids, chores sent in).
3. **Invite the co-parent as the first onboarding step** (SMS / WhatsApp / email link). This is the only built-in viral loop we have: one install should become 1.3 to 1.6 accounts.
4. **Payday share card**: when a parent pays out, generate an image ("Emma earned $4.50 this week doing 6 chores", no face, with a QR to the app) that shares to the family group chat or Instagram stories. Grandparents are a real audience.
5. **Ratings prompt** after the first approved payday (Apple allows 3 prompts a year; never on first open). We need 50+ ratings in Canada before ads convert.
6. **Store listing fixes**: iOS subtitle "Chore Chart & Allowance", the hidden 100-character keyword field, category Productivity (not Finance, so we're not ranked next to Greenlight's 491K ratings), localized titles, subtitles and screenshots in FR-CA, ES, PT-BR. Play: short description with "free chore chart, allowance tracker"; FR/ES/PT store listings. Apple's search indexing takes 1 to 3 days after approval; rankings settle over 2 to 4 weeks.
7. **Press page** `firstpayday.app/press` (EN/FR): one-paragraph story (a dad in Québec built it for his own kids), screenshots, the 55-second montage, logo files, founder photo, contact email. Every pitch below links to it.
8. **Six printable chore charts by age** (5–6, 7–9, 10–12, teens) plus a "Payday certificate", in 4 languages, as PDF with a QR code to the app, each on its own page on the site with a Pinterest-size image. Done by **Dec 20** so Pinterest and Google index them before the January peak ("chore chart" searches: 27,100 in January vs 14,800 in December).
9. **"Turn your old tablet into a chore board" page + how-to** (iPad, Fire tablet, Chromebook, kiosk mode). Distinct search intent and the best TikTok hook we have.

**Accounts (Diego, ~2 hours total)**
- Create the Facebook Page, Instagram, TikTok and YouTube channel using the "Page & channel setup" tab (names, bios and images are ready). Audience setting on YouTube: "not made for kids".
- Create a **personal** Product Hunt account now (it has to be at least a week old; company accounts are banned) and a Hacker News account.
- Link Apple Ads to App Store Connect the day iOS is approved: Apple gives a **US$100 credit** automatically. Check the Google Ads "Promotions" tab for a new-advertiser credit before any spend.
- Register First Payday as a **Financial Literacy Month** activity with FCAC (theme "Talk Money", #FLM2026 #TalkMoney; free national listing) and sign the AMF's **SQEF 2024-2026 engagement form** (free; gives a provincial stamp). Both this month.
- Declare trader status in the Play Console (blue banner).

## 4. Launch week (the day Apple approves)

Everything in one week, so the signals stack. All in the first person, as the founder, with the press page link.

| Day | Where | What |
|---|---|---|
| Day 0 | Both stores | Verify the listings, upload 1.0.4 to Play if not done, put the badges live on the site. |
| Day 0 | Friends and family | Personal message (not groups) to 20 to 30 families: try it, send honest feedback, leave a rating. Ask for permission to film a kid's hands tapping "I did it!". |
| Day 1 (Tue or Wed) | **Product Hunt** | Scheduled launch, category "Apps for kids". Ask for feedback, never for upvotes. Expect dozens of signups, not thousands; the value is the badge and the backlink. |
| Day 1 | **Hacker News** | `Show HN: First Payday – free chore chart that pays kids (no real money)`. One shot; never ask for votes. |
| Day 1 | **r/SideProject** | Text post, working product, live links, feedback framing. |
| Day 2 | **r/Quebec** and **r/montreal** (French) | Text post, no link in the body: "Papa de la Rive-Sud, j'ai créé une appli gratuite pour les tâches des enfants; je cherche 20 familles pour la casser." Message the mods first. Don't reuse the English text. |
| Day 2 | **MobileSyrup** (Apps & Software) | iOS launch pitch: Canadian app, free, EN+FR, no card, no real money. |
| Day 3 | **CBC Montreal** (Daybreak) and **Global News Montreal** | "Local dad builds a free chore app so his kids learn money" with the Financial Literacy Month hook. |
| Day 3 | **Radio-Canada** regional newsroom form, **La Presse** Famille/Affaires, **Vifa Magazine** | Same story in French. Vifa is public-interest and free: pitch an article, not an ad. |
| Day 4 | **Facebook, priority-A groups** (28 in the tracker) | Join in week 0. On day 4 post the helpful "what worked for us" template (no link) in the 5 to 8 that allow it; message the admins of the others with the printable offer. |
| Day 5 | **AlternativeTo** (free alternative to Greenlight, BusyKid, Homey, OurHome), **Educational App Store** (free to submit, 10-day educator review; pitch inclusion in their "9 Best Chore Apps 2026" guide), **Common Sense Media** contact form (lead with no ads, no purchases, no kid accounts). | |
| Day 7 | Both stores | First ratings push to everyone who signed up in the week. |

Daily on every channel that week: one demo clip from the content calendar (same vertical clip on Reels, Shorts, TikTok and the Facebook Page).

## 5. Weeks 2 to 8: the steady routine (about 5 hours a week)

- **Daily (15 min):** post the day's clip from the content calendar. Reply to every comment.
- **3 times a week:** a real answer in a Facebook group or a Reddit thread that asks "chore chart app?" / "allowance app?" / "tableau des tâches". Search r/Parenting, r/ADHDparenting, r/homeschool and the groups weekly for those phrases. Links only where rules allow; otherwise "happy to share if the rules permit".
- **Weekly (1 hour):** contact 10 creators from the Influencers tab, fit score 5 first, in their language, with the templates. Start with: Andy Hill (Marriage Kids and Money), Beth Kobliner, Ron Lieber, Jordan Page, Maya Corbic (Ontario), Béatrice Bernard-Poulin, Je suis une maman, Mélanie Bilodeau, Maman Caféine (Québec), Clariana Barcelos and Thiago Godoy (Brazil), Sofía Macías and Paty Mier (Mexico), Natalia de Santiago (Spain). Offer: try it with your family, a giveaway, or the "30-day chore challenge". One follow-up after 7 days, logged in the tracker.
- **Weekly:** 3 to 5 Pinterest pins per printable ("Free printable chore chart for 7 year olds", FR/ES/PT too). Pinterest is 70% women, parents research there, and it's the one channel where chore charts are already huge.
- **Every 2 weeks:** a guest pitch. Podcasts: The Art of Allowance (John Lanza), Marriage Kids and Money. Listicles with a "best free option" slot: Bankrate ("Best money apps for kids", "Family apps to manage allowances and chores"), NerdWallet, Forbes Advisor, Young and the Invested, Money Prodigy, Educational App Store. 5 lines + press page + both store links; update them when a milestone lands.
- **Every Friday (20 min):** fill the KPIs tab. Keep what moved active homes, drop what didn't.

## 6. Paid: three budget tiers

Hold all paid until **Dec 26**: Meta CPMs peak in November (global median $25) and the January habit-reset peak is the best window we'll get before back-to-school.

**$0 (the default)**
Everything in sections 4 and 5, the Apple Ads $100 credit, Financial Literacy Month and SQEF listings, Product Hunt, Educational App Store submission, AlternativeTo, Common Sense Media, press pitches.

**~$500 CAD (recommended first test, Dec 27 to Jan 20)**
- **Apple Ads Advanced, Canada, $10/day** (not Basic; Basic teaches nothing). Three campaigns: competitor exact-match (homey chores, chore pad, chores allowance bot, walo, mydoh) $3/day; generic chore terms (chore chart, chore app for kids, kids chore tracker, routine chart kids, allowance tracker) $5/day, max tap $1.25; discovery $2/day, harvested weekly. Separate EN and FR-CA ad groups, each with its own custom product page. Benchmarks for Canada: $1.17 per tap, $2.24 per install. Stay away from "allowance app" and "kids debit card" terms: that's Finance-category pricing (US install ~$10, against Greenlight).
- **Meta Advantage+ App campaign, Canada, parents 28–50, $15/day for 20 days (~$300)**: three vertical UGC-style creatives (hands + tablet, no faces: "my 7-year-old asks to do chores now" → kid taps "I did it!" → parent approves on phone; a "free vs $7/month" comparison; a Québec-French version). Expected 60 to 120 installs at $2.50 to $5. Do not self-declare as financial services (we don't move money) or we lose demographic targeting.
- **Decision rule:** cost per "first chore approved" at or under $8 and 7-day retention on paid at least equal to organic. Otherwise stop and go back to $0.

**~$1,500 CAD (only after the $500 test passes)**
- Sponsored article on **Maman pour la vie** (the largest independent Québec parenting site that openly sells "Présenté par" articles; ask for the kit at /statique/contact?topic=pub; comparable small sites charge $250 to $500).
- One **Paved** newsletter placement with a mid-size family newsletter (indie lists $100 to $500; ParentsCanada and Family Fun Canada sell newsletter slots too; ask for quotes).
- **TPL Moms** sponsored post (active Québec millennial-mom network; price via their publisher).
- Micro-influencer seeding: gift + small fee to 3 to 5 Québec parent accounts.
- ~$200 for press-kit assets (FR/EN one-pager, founder photo, 30-second cut).
- Skip at this stage: Coup de pouce / KO Média ($10,500+ for a co-branded article), Today's Parent and BDG branded content (five figures), BetaList (~$129, paid listing for a consumer app with little upside), TikTok ads (setup overhead; revisit above $1,000/month), Google App campaigns under $100/day (Google itself says daily budget should be 50× target cost per install).

## 7. Calendar with hooks

| When | Hook | We do |
|---|---|---|
| **Now to Nov 30** | Canada's Financial Literacy Month ("Talk Money", #FLM2026); AMF's Mois de la littératie financière | Register the activity, sign the SQEF form, publish a FR/EN "your first money talk with your kid" post, pin it. |
| **Launch week** (when Apple approves) | iOS launch | Section 4. |
| **Late Nov to Dec 24** | Holidays: 56% of Canadian parents say budgets are too tight for what kids want; gaming is the #1 thing kids save for | "Let them earn half of it" posts; savings-goal angle. No paid spend. Printables live by Dec 20. |
| **Dec 26 to Jan 20** | New Year routines; "chore chart" searches peak in January (+83% vs December) | The $500 paid test. iOS In-App Event "New Year Chore Reset". "2027 chore chart" printables. Daily clips. |
| **Feb** | Quiet month | Ship custom product pages (ADHD/routines, old tablet, argent de poche Québec), ratings prompt review, prep Global Money Week. Pitch BetaKit if we've passed ~1,000 families. |
| **Mar 2 to 6** (Québec semaine de relâche) | Kids at home | "Relâche chore challenge" with a printable. |
| **Mar 15 to 21** | **Global Money Week** (OECD; Brazil and Mexico participate heavily) | In-App Event, ES/PT posts, pitch Latin American creators with the GMW tie-in, parent-committee (FCPQ/OPP) one-pager. |
| **Mar to Apr** | Spring cleaning; tax season | "Spring cleaning chore chart" / "ménage du printemps en famille"; r/PersonalFinanceCanada "teaching kids money" threads. |
| **June 2027** | (Rooster Money publishes its UK Pocket Money Index every June and gets press for it every year) | Publish "Combien les enfants québécois gagnent pour leurs tâches", anonymized from our data, once we have ~500 families. Pitch La Presse, Protégez-Vous, Radio-Canada, Global Montreal. Start collecting the data now. |

## 8. Rules that protect us

- Québec's Consumer Protection Act bans advertising to children under 13, and school boards bar commercial solicitation. **Every message is aimed at parents.** No school marketing; parent committees and teachers only, with a parent-facing tool.
- No children's faces without written permission. Hands + tablet is enough and converts fine.
- Always say "I'm the founder". Follow each group's rules; never message members one by one.
- The app is free. Never say "forever" or "never billed" in any language.
- Never self-describe as a financial product. We track money; we don't move it.
- Product Hunt and Hacker News: ask for feedback, never for votes.

## 9. What we measure (Friday, 20 minutes)

From Supabase + Vercel Analytics + the stores: new families, active homes (7-day), kids added, chores sent in, store installs per store per country, ratings count and average, signups by UTM source, creator contacts / replies / partnerships, Facebook groups joined / posted. The KPIs tab in the tracker already has the weekly grid; I'll add a SQL snippet to pull the product numbers.

Kill rules: a channel that produced zero active homes after 4 weeks of consistent effort gets dropped. A paid test that misses the $8 / retention rule stops.

## 10. Who does what

| Claude (can start now) | Diego |
|---|---|
| Store badges + `/app` short link, analytics + UTMs, co-parent invite first, payday share card, ratings prompt, press page, store listing copy in 4 languages, printable chore charts, old-tablet page, weekly KPI query, Apple Ads keyword lists and ad copy, Meta creative scripts, all outreach texts | Create the 4 social accounts, Product Hunt and HN accounts, Apple Ads link + credit, FCAC and SQEF registrations, Play trader status, upload 1.0.4, send the friends-and-family messages, record the 3 UGC clips (hands + tablet, 15–20 s each, one in French), approve budgets, be the face in press interviews |

## 11. Open questions to settle before launch week

1. Budget: start at $0, or approve the $500 test for Dec 27?
2. Which personal email and phone go on the press page?
3. Can we show Diego's own kids' hands and voices in clips, or only the demo home?
4. Do we want a savings-goal feature before the holidays, or keep the product frozen and market what exists?
