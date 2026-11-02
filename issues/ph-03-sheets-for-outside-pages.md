---
id: ph-03
title: GitHub install, billing portal and outside links open in an in-app sheet
type: AFK
status: open
blocked_by: [ph-01]
parent: docs/prd/phone-apps.md
repo: hiveop-apps
---

## What to build

Navigation policy gains `sheet` (SFSafariViewController / Custom Tabs) and `system-browser`. GitHub App install, Stripe billing portal and any outside link (docs, github.com) open in a sheet; closing it returns to the same page, where the site's existing visibilitychange re-check picks up the result. Only http(s) and `hiveop:`; everything else denied.

Covers user stories 38–39.

## Acceptance criteria

- [ ] navPolicy tests for each URL class
- [ ] Emulator/simulator: GitHub App install link opens a sheet; closing returns to the workspace settings page
- [ ] An outside link never navigates the main web view away from the site

## Blocked by

- ph-01
