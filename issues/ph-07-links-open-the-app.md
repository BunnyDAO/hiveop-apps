---
id: ph-07
title: HiveOp links and the email sign-in link open the app
type: AFK
status: done
blocked_by: [ph-01, ph-04]
parent: docs/prd/phone-apps.md
repo: hiveop-apps + wenrwa-arena
---

## What to build

Universal Links (iOS) and verified App Links (Android) for app.hiveop.io: the site serves `/.well-known/apple-app-site-association` (JSON, no redirect) and `/.well-known/assetlinks.json`; app ids/fingerprints come from env. Excluded paths: `/api/*`, `/desktop-return`. The app opens the linked path in the web view. The email sign-in link (`/auth/verify`) opens the app and signs in there.

Covers user stories 13, 25.

## Acceptance criteria

- [x] Both well-known files return 200, correct content type, no redirect (test + curl on prod after deploy)
- [x] Path parsing reuses the sanitised deep-link rules (unit tests)
- [x] Emulator opens Inbox (verified). Simulator `simctl openurl`: NOT verified, needs a signed build on a device (owner drill)
- [ ] Email-link sign-in completes inside the app

## Blocked by

- ph-01
- ph-04

## Done

- Site (wenrwa-arena, gh/master): `lib/appLinks.ts`, `app/.well-known/apple-app-site-association` and `assetlinks.json` routes. iOS appID defaults to `ATG843LDGZ.io.hiveop.app` (env `APPLE_APP_IDS`, comma list). Android: env `ANDROID_SHA256_FINGERPRINTS` (comma list); unset serves `[]` on purpose. Excluded: `/api/*`, `/desktop-return`, `/.well-known/*`. Prod curl: 200, `application/json`, no redirect.
- App: `mobile/src/universalLink.ts` (reuses `sanitizePushPath`), shared fixture `universalLink.cases.json` run by vitest, JVM (`UniversalLinkTest`) and `scripts/check-universal-link-swift.sh`. Android autoVerify filter + `MainActivity.openAppLink`; iOS `com.apple.developer.associated-domains` (`applinks:app.hiveop.io`), `SceneDelegate` + `HiveOpViewController.openLink`.
- Emulator: with app links approved, cold start on `/inbox` and warm `/auth/verify`, `/fleet` load in the web view; `/desktop-return` is ignored.
- Owner left: set `ANDROID_SHA256_FINGERPRINTS` on Vercel (wenrwa-hive) to the upload key and the Play App Signing key (Play console > App integrity) so autoVerify passes on real installs (the shared debug keystore was deliberately NOT put in prod); iOS Universal Link tap and a real email sign-in link on a device (needs the Associated Domains capability on the app id).
