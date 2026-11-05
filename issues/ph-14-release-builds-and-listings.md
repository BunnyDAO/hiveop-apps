---
id: ph-14
title: Release builds and store listings
type: HITL
status: open
blocked_by: [ph-03, ph-04, ph-06, ph-07, ph-08, ph-10, ph-12, ph-13]
parent: docs/prd/phone-apps.md
repo: hiveop-apps (+ owner)
---

## What to build

Signed release builds: iOS archive uploaded with an App Store Connect API key; Android bundle signed with an upload key (owner keeps a backup), Play App Signing on. One version source. Store listings for both: name, subtitle, description (no parked features), screenshots for phone + tablet on both stores, privacy policy URL, Apple privacy labels, Play data-safety form, age rating, export compliance (standard encryption only). Reviewer notes + a demo account with credits. Re-check the US link-out rules for both stores right before submission. Owner actions: APNs key, App Store Connect API key, Firebase project, Apple Services ID/key, demo account.

Covers user stories 41.

## Acceptance criteria

- [ ] TestFlight build installable by the owner
- [ ] Play internal-testing build installable
- [ ] Listings complete in both consoles; banned-word check on listing copy
- [ ] US link-out rules re-verified with sources, date noted in the issue

## Blocked by

- ph-03
- ph-04
- ph-06
- ph-07
- ph-08
- ph-10
- ph-12
- ph-13

## Progress

- Part A (2026-11-04): signed builds. One version source `mobile/package.json` `{version, build}`; Android reads it in `app/build.gradle`, iOS via `node scripts/sync-version.mjs [--bump]`. Android release signs from gitignored `android/key.properties` or `HIVEOP_KEYSTORE*` env. `ITSAppUsesNonExemptEncryption=NO` set.
- iOS 0.1.0 (1) uploaded, VALID, in internal TestFlight group "Internal" (ryan@wenrwa.com). Archived with a manual App Store profile ("HiveOp App Store", created via ASC API); aps-environment=production verified in the IPA.
- Android `hiveop-0.1.0-1.aab` built and upload-key fingerprint verified. Owner uploads it to Play.
- Still open: listings, screenshots, link-out re-check, HITL installs.

- Part B (2026-11-04):

Store copy and research landed under `store/`: listing.md (banned-word check passed), apple-privacy.md, play-data-safety.md, age-rating.md, review-notes.md, link-out-rules.md (dated 2026-11-04, re-check before submit), screenshots/ (signed-out placeholders from the site). Open for owner: demo account, privacy policy rewrite (still a counsel draft with crypto sections), Google ECL enrollment and a pre-link notice slice, report/block reachability check, real screenshots after the demo account exists. Builds (part A) not touched.
