---
id: dsk-06
title: payment and github app windows
type: AFK
status: open
blocked_by: [dsk-01]
parent: docs/prd/desktop-app.md
repo: hiveop-apps
---

## What to build

Stripe checkout and portal, GitHub App install and GitHub OAuth authorize open in an app popup window sharing HiveOp's session (navigation policy decision `app-popup`). When the flow returns to the site, the popup closes and the main window navigates to the return URL (or refreshes, for the existing install-polling flow). GitHub sign-in works in the main window. Stories 22, 23.

## Acceptance criteria

- [ ] Subscribe → Stripe opens in an app window; completing/cancelling returns the main window to the site's return page
- [ ] Install GitHub App opens in an app window; the settings screen sees the install after it closes
- [ ] GitHub sign-in completes inside the app
- [ ] GREEN = navigation-policy tests cover these hosts + manual run against prod Stripe test-mode-free paths (no purchase made)

## Blocked by

- dsk-01
