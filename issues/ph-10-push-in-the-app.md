---
id: ph-10
title: Notifications in the app: ask, switch, tap to open
type: AFK
status: done
blocked_by: [ph-01, ph-02, ph-09]
parent: docs/prd/phone-apps.md
repo: hiveop-apps + wenrwa-arena
---

## What to build

Shell: push plugin; reports permission state and token; tapping a notification opens its `path` (sanitised) in the web view; sets the badge. Capabilities `push`, `open-settings`. Site: permission state machine — after first sign-in a HiveOp screen "Get a buzz when an agent needs you" (Turn on / Not now); Turn on → OS prompt; Not now → re-ask once on the first needs-you arrival, then never; You → Settings → Notifications switch, with a "blocked in phone Settings" state and a button opening the app's Settings page. Registers the token on grant, unregisters on sign-out or switch off.

Covers user stories 15, 16, 18, 20, 21.

## Acceptance criteria

- [ ] State-machine unit tests (unknown → pre-prompt → granted/denied/not-now → one re-ask)
- [ ] Simulator `simctl push` / FCM test message with the app closed → tap opens the Inbox item
- [ ] Sign-out unregisters the device (backend row gone)
- [ ] Copy within tight-copy rules; no text under 12px

## Blocked by

- ph-01
- ph-02
- ph-09

## Done (2026-11-02)

Shell 6887da2, site 46e59218. Capabilities now [open-sheet, auth-bounce, storefront, push, open-settings]. iOS: simctl push + tap cold/background opens the item path, bad paths → /, token reached a stubbed /push/devices. Android: tap intents proven; no FCM token on the headless emulator (SERVICE_NOT_AVAILABLE). google-services.json is git-ignored, fetched by `npm run fetch:firebase`. Owner: APNs key + Push capability on io.hiveop.app, FCM_SERVICE_ACCOUNT_JSON on the backend; drill real tokens, iOS foreground tap, sign-out delete.
