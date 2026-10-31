---
id: dsk-17
title: first public release
type: HITL
status: open
blocked_by: [dsk-06, dsk-08, dsk-09, dsk-11, dsk-12, dsk-13, dsk-14, dsk-15, dsk-16]
parent: docs/prd/desktop-app.md
repo: hiveop-apps
---

## What to build

With the owner's OK: create the public BunnyDAO/hiveop-apps GitHub repo, push, build `npm run dist`, publish v0.1.0 to GitHub Releases, confirm /download links resolve. Owner installs on their Mac and runs the drill: sign in (email + Google), native browser, local agent with no CLI installed, takeover of their CLI bridge, close-to-tray, Quit.

## Acceptance criteria

- [x] Public repo created only after owner says yes (2026-10-30)
- [x] Release assets downloadable from /download (v0.1.2: Mac, Windows, Linux AppImage + deb; all 200)
- [ ] Owner drill passes on Mac; Windows/Linux status stated plainly in the release notes

## Blocked by

- dsk-06
- dsk-08
- dsk-09
- dsk-11
- dsk-12
- dsk-13
- dsk-14
- dsk-15
- dsk-16
