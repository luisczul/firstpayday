# Research: getting the first downloads (store optimization, ads, communities, loops, timing)

Researched 2026-11-09 for the launch plan (`2026-11-launch-plan.md`). **[est.]** marks estimates; everything else has a source and year.

## 1. App Store Optimization for the chore/allowance niche

### Competitor store pages (fetched Nov 2026)

| App | Store title | Subtitle (iOS) | Category | Rating / count | Model | Notes |
|---|---|---|---|---|---|---|
| Homey - Chores and Allowance | same | "Chore chart & money tracker" | Productivity | 4.1 / 2.8K | Free + IAP ($6.99/mo, $59.99/yr) | US (Memphis), Slovenian founders |
| Joon: Kids ADHD Chore Tracker | same | "Family Chores Organizer Chart" | Health & Fitness | 4.7 / 6.6K | Free + IAP ($12.99–$149.99) | ADHD positioning |
| Chores & Allowance Bot | same | "Family Chore Chart & Savings" | Productivity | 4.5 / 11K | Free, Premium $6.99/mo, $34.99/yr, $89.99 lifetime | FR listing "Tâches & Poche Bot" |
| Chore Pad: Chores & Rewards | same | "Family Chore Charts & Rewards" | Productivity | 4.2 / 144 | $2.99–3.99/mo | US |
| S'moresUp - Best Chores App | same | "Your Partner in Parenting." | Productivity | 4.2 / 896 | $7.99/mo, $79.99/yr | US |
| Greenlight: For Families | same | none | Finance | 4.8 / 491K | $5.99–$24.98/mo | real debit card |
| GoHenry by Acorns Kids Banking | same | "Debit Card, Allowance, Chores" | Finance | 4.5 / 15K US, 41K UK | subscription card | |
| BusyKid | same | none | Finance | 3.4 / 1.5K | card | |
| NatWest Rooster Money | same | "Kids Debit Card & Pocket Money" | Finance | 4.7 / 11K UK | free tracker; card £1.99/mo | closest "free tracker" analogue |
| Mydoh - Youth Money App & Card | same | "Securely earn, spend, and save" | Finance | 4.5 / 5.6K CA | free app + RBC card | Canada, EN+FR |
| WALO | "WALO Smart Allowances for money-savvy kids & teens" (Play) | n/a | Finance | low volume | $7.99–9.99/mo, prepaid card | Montréal. iOS "Walo" id1659037817 is a different Colombian wallet |
| OurHome by Elusios | same | n/a | Productivity | new | free; rewards/offline kids Premium | |

Sources: App Store ids 1033286805, 1482225056, 629797415, 384854237, 1287367596, 1049340702, 683249974, 1474508509, 743769885, 1489334252; Google Play com.walo.app, com.elusios.ourhome.

Takeaways:
- Trackers use Productivity; card companies use Finance. Choose **Productivity (iOS) / Family or Parenting (Play)**.
- Homey and Chores & Allowance Bot are the two apps we'll be compared to; both charge $6.99/mo for premium. "Free, no premium tier" is a real differentiator.
- Search terms parents use: chores, chore chart, allowance, rewards, kids, family, money tracker, pocket money (UK/CA), savings, routines. Nobody owns "payday" or "I did it" (zero search volume, so we need generic terms around the brand).
- Suggested iOS fields (30/30/100): title `First Payday: Kids Chores` (24). Subtitle `Chore Chart & Allowance` (23) or `Family Chores, Allowance Pay` (28). Keyword field (no spaces after commas, don't repeat title/subtitle words): `reward,chart,routine,pocket,money,savings,tablet,family,children,task,tracker,earn,habit,responsibility`.
- FR: "tâches ménagères", "argent de poche", "corvées" (Québec), "récompenses", "tableau des tâches". ES: "tareas del hogar", "quehaceres", "mesada" (MX), "domingo/paga" (ES), "recompensas niños". PT-BR: "tarefas domésticas", "mesada", "mesada infantil", "recompensas", "rotina". FR terms from competitor listings and https://raccoon.kids/fr/blog/application-taches-menageres-enfant (2026); ES/PT **[est.]**, verify in each storefront's autocomplete.

### 2026 store mechanics
- Limits: iOS title 30, subtitle 30, keyword field 100, description not indexed; Play title 30, short description 80, full description indexed. https://www.apptweak.com/en/aso-blog/app-store-keyword-research-aso ; https://appfollow.io/blog/app-store-optimization-title (2026).
- Title words weigh most; Apple OCRs screenshot captions. https://asomobile.net/en/blog/aso-in-2026-the-complete-guide-to-app-optimization/ (2026).
- Custom Product Pages: limit 70 per app since Oct 2025; a CPP can take keywords and appear in organic search since July 2025. https://www.apptweak.com/en/aso-blog/guide-to-custom-product-pages-cpp ; https://respectaso.com/blog/custom-product-pages-app-store-guide-2026/ . Use one per angle (ADHD routines, tablet in the kitchen, argent de poche Québec) and one per paid channel.
- Google Play: up to 50 custom store listings; listing experiments support localized variants in up to five languages. https://www.appalize.com/blog/aso-strategies/custom-store-listings-on-google-play-setup-and-best-practices ; https://appsops.store/news/google-play-store-listing-experiments-ai-suggestions-q4-2026 .
- In-App Events (iOS): name (30) and short description (50) indexed; appear once a version is approved. https://appsops.store/news/in-app-events-aso-discoverability-strategy-2026 ; https://trysonar.app/blog/in-app-events-aso-what-indie-devs-miss .
- Ratings prompt: Apple caps the system prompt at 3 per app per rolling 365 days; call it after a success moment. https://www.apprankr.in/blog/apple-app-store-review-prompt-three-times-year ; https://www.lokall.app/blog/app-store-review-prompt-timing (2026).
- Time to appear in search: no authoritative figure. Practitioner consensus **[est.]**: 24–72 h indexing, 2–4 weeks for rankings to settle; a new app won't rank for head terms; target long tail.
- Screenshots that convert (pattern from Homey, Joon, Rooster): kid view with a visible balance first, parent approval on a phone second, caption-first, one set per language.

## 2. Apple Ads and Google App campaigns

Search-results benchmarks, full-year 2025 (AppTweak, https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks):

| Market | CPT | CPI | TTR | CR |
|---|---|---|---|---|
| US | $1.91 | $4.06 | 6.6% | 55% |
| UK | $1.35 | $2.60 | 7.2% | 57% |
| Canada | $1.17 | $2.24 | 7.6% | 56% |
| France | $0.92 | $1.78 | 7.4% | 57% |
| Brazil | — | $1.05 | 9.2% | 54% |
| Mexico | — | $1.10 | 7.9% | 54% |

US by category: Finance CPT $4.17 / CPI $9.65; Productivity $1.74 / $3.58; Education $1.52 / $2.91; Lifestyle $1.18 / $2.62. Adapty 2026 US CPT $1.58 (https://adapty.io/blog/apple-search-ads/). **[est.]** Canada CPI $1.50–3.00 on chore terms, $4–8 on allowance/money terms.

- Apple gives a one-time US$100 credit when the Apple Ads account is linked to the App Store Connect account (top-level account, one live app). https://searchads.apple.com/help/billing/0032-apple-search-ads-promo-credit ; https://bitrig.com/blog/apple-ads-beginners-guide (2026).
- Basic: pay per install, Apple picks keywords. Advanced: pay per tap, you choose keywords, match types, countries, placements; multiple search-results slots from March 2026. https://superapp.dev/blog/apple-ads-apple-search-ads-beginners-guide-2026 ; https://almcorp.com/blog/apple-app-store-multiple-search-ad-slots-march-2026/ . Use Advanced even at $10/day.
- Google App campaigns: CPI Android $0.50–2.00, iOS $1.50–4.00 (US tier); Q1 2026 roundup iOS $5.84 / Android $1.92. https://adapty.io/blog/google-app-campaigns-playbook-2025/ ; https://www.digitalapplied.com/blog/mobile-app-marketing-statistics-2026-install-data . Google recommends daily budget ≥ 50× target CPI. https://blog.playio.co/google-app-campaigns-mobile-games (2026). Credits: https://support.google.com/google-ads/answer/15329625 ; https://support.google.com/google-ads/answer/6388096 ; check the account's Promotions tab.

$10/day Apple Ads test (Canada): A) competitor exact match (`homey chores`, `chore pad`, `chores allowance bot`, `s'moresup`, `walo`, `mydoh`) $3/day, max CPT $1.00. B) generic (`chore chart`, `chore app for kids`, `chores for kids`, `kids chore tracker`, `routine chart kids`, `allowance tracker`) $5/day, max CPT $1.25. C) discovery (Search Match) $2/day; harvest weekly; negatives `adult`, `roommate`, `cleaning service`, `debit card`. Separate EN and FR-CA ad groups with a CPP each. 14 days minimum; kill keywords with >20 taps and 0 installs; success = CPI ≤ $3 CAD and D7 retention on paid ≥ organic.

## 3. Meta and TikTok app-install ads to parents

- Meta CPI 2025–26: Android $1–4, iOS $2–6; Canada/US/UK/AU $2–8 by category. https://launchshots.app/blog/meta-ads-app-install-2026 ; https://makeappads.com/guides/app-install-ads-cost .
- Meta CPM Canada $11.47–14.03 (2025), ~$13.40 projected 2026; November peaks (global median $25 in Nov 2025). https://www.adamigo.ai/blog/meta-ads-cpm-cpc-benchmarks-by-country-2026 ; https://paceads.com/research/meta-ads-statistics-2026 .
- TikTok: CPM $4–5 global (Aug 2025–Jul 2026), app-install median ~$12.40; Canada CPM $6–12; CPI $0.50–2.50, median $1.72. https://www.triplewhale.com/blog/tiktok-benchmarks ; https://www.rocketshiphq.com/tiktok-performance-advertisers-report-2025-summary/ ; https://www.businessofapps.com/ads/cpi/research/cost-per-install/ .
- **[est.]** free parenting utility in Canada: Meta CPI $3–6 iOS / $1.50–3 Android; TikTok $1.50–3 with worse retention.
- Targeting: no targeting of under-18s beyond age/location/gender (Meta teen rollout April 2026). Parent segments still available in 2026: Parents (all), of preschoolers 3–5, early school-age 6–8, preteens 8–12, teens 13–18; verify in Ads Manager. https://www.get-ryze.ai/blog/back-to-school-meta-ads-targeting-parents ; https://www.wickedreports.com/blog/meta-removes-detailed-targeting-exclusions-from-ad-campaigns . Do not self-declare as financial services.
- Creative that works: UGC-style 9:16, parent 3-second hook, screen-recorded tablet demo of the kid tapping "I did it!", parent approving on phone; hands + tablet, no faces; subtitles; Québec French voice. TikTok Spark Ads on a real creator post beat brand posts.
- $300 test: one Meta Advantage+ App campaign, Canada, 28–50, 3 creatives (UGC demo, "free vs $7/mo", FR-CA), $15/day × 20 days. **[est.]** 20–25k impressions, 60–120 installs at $2.50–5. Decision: cost per "first chore approved" ≤ $8 and D7 retention ≥ organic. Run after iOS is live.

## 4. Reddit and other communities

Rules from third-party trackers checked Aug–Oct 2026; re-read each sidebar before posting. Pattern: link + young account = auto-removal; text post, first person, no URL, mention the app only if asked.

| Community | Founder posts? | Source |
|---|---|---|
| r/Parenting (~7M) | No self-promo, no links; helpful comments OK | https://www.threadotter.com/subreddit-rules/parenting |
| r/Mommit (2.7M) | Restricted | https://www.replyhey.com/subreddits/mommit |
| r/daddit | Unclear/restricted | https://www.threadotter.com/subreddit-rules/daddit |
| r/ADHDparenting | Rules silent; no-URL default | https://www.threadotter.com/subreddit-rules/adhdparenting |
| r/homeschool | Links allowed; first-person question posts | https://www.threadotter.com/subreddit-rules/homeschool |
| r/PersonalFinanceCanada | Question/news format; obvious ads removed | https://www.threadotter.com/subreddit-rules/personalfinancecanada |
| r/Quebec, r/montreal | Francophone; ask mods; don't reuse EN text | https://www.threadotter.com/subreddit-rules/quebec ; .../montreal |
| r/SideProject (~850K) | Yes; working product, live link, feedback framing | https://oneup.today/tools/reddit-self-promotion-checker/sideproject |
| r/androidapps, r/iosapps | Check sidebar for dev self-promo threads | — |
| ES/PT parenting subs | Thin; use Facebook city groups, WhatsApp school groups, Instagram/TikTok "maternidade real" creators | — |

- Show HN: must be tryable, non-trivial, never ask for votes. Title `Show HN: First Payday – free chore chart that pays kids (no real money)`. https://launchit.fast/how-to/how-to-launch-on-show-hn ; https://dev.to/markfulton/product-hunt-and-show-hn-launch-rules-what-the-pages-say-and-a-4-week-prep-plan-5f35 .
- Product Hunt 2026: free; personal accounts only; account ≥ 1 week old; soliciting upvotes = ban; no waitlists; relaunch only after a major update. https://launchrepo.dev/guides/product-hunt-launch-rules/ ; https://getlaunchlist.com/checklists/producthunt . Official guide: https://help.producthunt.com/en/collections/19793093-launch-guide (launches go live 12:01 AM PT; weekends quieter). Recent chore-app launches got modest traction (Chorey Hero Jan 2026: 14 upvotes).
- Indie Hackers: community first, 4–6 months of participation before a launch post. https://awesome-directories.com/blog/indie-hackers-launch-strategy-guide-2025 .
- Pinterest: 619M MAU (Q4 2025), ~70% women; 64% of parent users research products online. https://sproutsocial.com/insights/pinterest-statistics/ ; https://newsroom.pinterest.com/news/parenting-trend-report-2026/ . "chore chart" web search 18–27K/month, 78% US, CPC $1.77; **January highest (27,100), December lowest (14,800)**. https://www.rankhero.com/keywords/chore-chart (Oct 2026). Mydoh already does printable charts: https://www.mydoh.ca/tools/chore-charts-for-kids-and-teens/ . Play: 6–10 printables by age in 4 languages, PDF + Pinterest image, QR to the app, 3–5 pins each, deep links to stores.

## 5. Growth loops from comparable apps

- Homey: Instagram mock-up under #DIYChoreChart → landing page with 500 families pre-launch → Memphis theatre partnership (free tickets for kids who finish chores) → Apple feature. https://www.hypepotamus.com/homey/ ; https://highgroundnews.com/innovationnews/Homey.aspx ; https://www.indiehackers.com/interview/eb3ee0823a .
- Greenlight: parent-first paid social; Greenlight Classrooms (free K-12 lessons) as a funnel; bank partnerships; Amazon Kids+ bundle; referral "$45–50". https://research.contrary.com/company/greenlight ; https://greenlight.com/redeemreferral45-may-2026 .
- Rooster Money: free tracker first, card later; annual Pocket Money Index as a press engine (10th edition 2025: 30% of UK kids do chores as a condition of pocket money; avg weekly income £9.13); Bikeability sponsorship; schools program; free "Money Matters" course. https://www.natwestgroup.com/news-and-insights/news-room/press-releases/financial-capability-and-learning/2025/jun/annual-natwest-rooster-money-pocket-money-index-reveals-industri.html ; https://roostermoney.com/pocket-money-index-hub/ ; https://roostermoney.com/money-matters-course/ .
- Joon: "ADHD" in the title; "recommended by child psychologists, OTs, pediatricians"; virtual-pet retention loop.
- ClassDojo: regional teacher ambassadors, then Mentors (1 per 30 teachers). https://blog.classdojo.com/announcing-classdojo-ambassadors-thank-you-to/ ; https://www.classdojo.com/become-mentor/ .

Loops for First Payday, by effort/impact: 1) invite co-parent first (**[est.]** 1 install → 1.3–1.6 accounts); 2) payday share card with QR (grandparents: 21% of Canadian parents rely on them for holiday gifts, Interac Nov 2025); 3) printable chore charts by age; 4) Québec "pocket money index" once ~500 families; 5) parent-committee (FCPQ/OPP) one-pager for Financial Literacy Month / Global Money Week, teacher ambassadors only after 1,000 families; 6) "old tablet → kitchen chore board" page + video.

## 6. Timing, Nov 2026 to Apr 2027

| When | Hook | Facts |
|---|---|---|
| Nov 2026 | Canada Financial Literacy Month, theme "Talk Money", #FLM2026 #TalkMoney, FCAC's 25th anniversary; organizations register activities. https://www.canada.ca/en/financial-consumer-agency/campaigns/financial-literacy-month.html . AMF Mois de la littératie financière (2026 focus on AI and finfluencers). https://www.lesaffaires.com/communique-de-presse/mois-de-la-litteratie-financiere-sinteresser-a-ses-finances-a-lere-de-lintelligence-artificielle-et-des-finfluenceurs (Oct 29, 2026). | Register an activity; FR/EN "first money talk" post. |
| Late Nov–Dec | 66% of Canadian parents say rising costs make holiday spending harder; 56% (RBC) say budgets are too tight for what kids want; 21% lean on grandparents. https://www.interac.ca/en/content/life/interac-survey-shows-canadian-parents-face-holiday-spending-stress-and-grandparents-are-stepping-up/ ; https://www.kawartha411.ca/2025/12/09/family-budgets-overheating-as-parents-grapple-with-high-costs-and-now-face-holiday-season-expenses-rbc-poll/ ; https://kidscreen.com/?p=224348 . Gaming is #1 thing kids save for (Rooster). | "Let them earn half of it". Hold paid until Dec 26 (CPM peak). |
| Dec 26–Jan 31 | "chore chart" searches peak in January (+83% vs December, Rankhero Oct 2026); Sensor Tower: download spikes in the last week of December. https://asoworld.com/en/blog/new-year-2027-aso-plan-for-health-fitness-apps-a-6-week-ratings-and-keyword-schedule/ . | Paid test window; In-App Event "New Year Chore Reset"; "2027 chore chart" printables by Dec 20. |
| Feb | Quiet | Ship ratings prompt, CPPs, prep GMW. |
| Mar 15–21, 2027 | Global Money Week (OECD/INFE). https://www.globalmoneyweek.org/ . Brazil and Mexico participate heavily. | In-App Event, ES/PT content, school/PTA sheet. |
| Mar–Apr | Spring cleaning; semaine de relâche (early March); tax season | Spring printables; r/PersonalFinanceCanada threads. |
| June | Rooster's index drops every June | Québec index 2027. |

Caveat: Google Trends could not be fetched; the January peak rests on Rankhero plus Sensor Tower commentary.

## Ranked: 12 highest-leverage actions (solo founder, ~5 h/week, $0–500/month)

1. Fix the store listings (subtitle, keyword field, Productivity, FR-CA/ES/PT-BR pages).
2. Invite co-parent as first onboarding step + payday share card.
3. Six printable chore charts by age in 4 languages with QR, pinned on Pinterest, before Dec 20.
4. Register as a Financial Literacy Month 2026 activity; FR/EN "first money talk" content this month.
5. Claim the Apple Ads US$100 credit on iOS approval; $10/day Advanced test Dec 27–Jan 20.
6. Ratings prompt after first approved payday.
7. Show HN + Product Hunt + r/SideProject the week iOS ships.
8. Québec media + r/Quebec in French.
9. ADHD/routines custom product page and content; helpful comments in r/ADHDparenting.
10. $300 Meta Advantage+ test, Canada, 3 UGC creatives, Dec 27–Jan 15.
11. "Old tablet → kitchen chore board" TikTok/Reels + page.
12. Start collecting data for a Québec pocket money index; PTA one-pager for Global Money Week.

Skip for now: TikTok ads, Google App campaigns under $100/day, teacher ambassador programs, Lemon8/Bluesky.

Caveats: no source publishes parenting-app CPI/CPT for Canada; subreddit rules are from third-party trackers; Apple's Basic-vs-Advanced page returned 404; the live Play listing body could not be fetched for audit.
