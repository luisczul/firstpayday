# Native apps: what's done and what the owner does next (2026-09-28)

## Done overnight
- **iOS** (luisczul/firstpayday_ios, SwiftUI, iOS 17+): CI green, 32/32 tests (unit + UI on iPhone 16 Pro sim).
- **Android** (luisczul/firstpayday_android, Kotlin/Compose, Android 8+): CI green, 36 unit + 8 UI tests on an API 34 emulator; debug APK uploaded on each CI run (artifact `firstpayday-debug-apk`).
- Both apps: native sign-in / sign-up, native Approvals (tips, send back), native Kids balances, Chores / Money / History / Settings / Share / Help as in-app pages, kids'-tablet mode (screen stays on, hidden 3-second corner exit), push notifications (need keys, below), native "Delete my account", 4 languages, `firstpayday://approvals` link.
- **Web (live):** `/api/app/v1/*` app API, in-app pages without duplicate web menus, push sending (APNs + FCM, off until keys exist), "Delete my account" in web Settings too.
- CI results and screenshots: branch `ci-status` in each repo (`ci/<sha>.txt`, `screenshots/<sha>/`).

## Owner to do (in order)
1. **Test on real phones against production** (everything so far ran against a mock server):
   - Android: download the APK from the latest GitHub Actions run (firstpayday_android → Actions → artifact) and install it.
   - iOS: install Xcode, then `brew install xcodegen && xcodegen` in the repo, open `FirstPayday.xcodeproj`, run on your iPhone.
2. **Apple:** Developer account → Team ID into `project.yml`; register bundle id `app.firstpayday.ios` with Push; create an APNs key (.p8) and add to Vercel (normal visible vars): `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID=app.firstpayday.ios` (and `APNS_ENV=development` while testing from Xcode).
3. **Google:** Firebase project → Android app `app.firstpayday.android` → `google-services.json` into `app/`; service account JSON → Vercel `FCM_SERVICE_ACCOUNT_JSON`. Play Console account; upload key (keystore not committed).
4. **Store listings:** screenshots, privacy labels / data safety (email for the account, no tracking/ads), a demo account for reviewers, privacy URL https://firstpayday.app/privacy. Each repo's README has the full checklist.
