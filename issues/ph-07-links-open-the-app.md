---
id: ph-07
title: HiveOp links and the email sign-in link open the app
type: AFK
status: open
blocked_by: [ph-01, ph-04]
parent: docs/prd/phone-apps.md
repo: hiveop-apps + wenrwa-arena
---

## What to build

Universal Links (iOS) and verified App Links (Android) for app.hiveop.io: the site serves `/.well-known/apple-app-site-association` (JSON, no redirect) and `/.well-known/assetlinks.json`; app ids/fingerprints come from env. Excluded paths: `/api/*`, `/desktop-return`. The app opens the linked path in the web view. The email sign-in link (`/auth/verify`) opens the app and signs in there.

Covers user stories 13, 25.

## Acceptance criteria

- [ ] Both well-known files return 200, correct content type, no redirect (test + curl on prod after deploy)
- [ ] Path parsing reuses the sanitised deep-link rules (unit tests)
- [ ] Emulator: `adb shell am start -d https://app.hiveop.io/inbox` opens the app on Inbox; simulator `simctl openurl` likewise
- [ ] Email-link sign-in completes inside the app

## Blocked by

- ph-01
- ph-04
