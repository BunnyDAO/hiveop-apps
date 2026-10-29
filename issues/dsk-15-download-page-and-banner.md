---
id: dsk-15
title: download page and banner
type: AFK
status: done
blocked_by: [dsk-04, dsk-07]
parent: docs/prd/desktop-app.md
repo: wenrwa-arena
---

## What to build

Signed-out-reachable `/download` page that detects the OS and links the latest GitHub Release asset for it (with the other OSes listed). On desktop browsers outside the app, the install banner becomes "Get the HiveOp app" → /download; dismissal remembered. Phones keep today's banner. Stories 1, 2.

## Acceptance criteria

- [ ] Mac/Windows/Linux browsers get the right primary download
- [ ] Desktop browser shows the new banner once; dismissed stays dismissed
- [ ] Phone banner unchanged; no banner in the app
- [ ] Copy is tight; nothing under 12px
- [ ] GREEN = arena gate + audit:ui at phone and desktop widths

## Blocked by

- dsk-04
- dsk-07
