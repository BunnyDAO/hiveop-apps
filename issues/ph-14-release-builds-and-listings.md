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
