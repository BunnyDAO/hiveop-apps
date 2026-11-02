---
id: ph-02
title: The site knows it's inside the phone app
type: AFK
status: open
blocked_by: []
parent: docs/prd/phone-apps.md
repo: wenrwa-arena
---

## What to build

One pure module reads `window.hiveopApp` (and the existing desktop global) and returns `{ kind: 'browser'|'desktop'|'phone-app', platform, has(cap) }`; nothing else touches the globals. Install banners (PWA and "Get the desktop app") never show in the phone app. Help shows the phone app version.

Covers user stories 8.

## Acceptance criteria

- [ ] Reader unit tests for browser, desktop, phone-app (ios/android), unknown capabilities, malformed global
- [ ] InstallBanner renders nothing for a phone-app shell (render test)
- [ ] Guard: no other module reads `window.hiveopApp`
- [ ] GREEN = arena vitest + lint:hooks + next build

## Blocked by

None — can start immediately
