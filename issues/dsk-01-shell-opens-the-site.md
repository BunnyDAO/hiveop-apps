---
id: dsk-01
title: shell opens the site
type: AFK
status: done
blocked_by: []
parent: docs/prd/desktop-app.md
repo: hiveop-apps
---

## What to build

Electron desktop app in `desktop/` that opens app.hiveop.io (site URL overridable for localhost:3000/staging) in exactly one window. Single-instance lock: a second launch focuses the existing window. Navigation policy as a pure module: in-window for the site and its GitHub/email auth chain; system browser for everything else; non-http(s) schemes denied except `hiveop:`. Locked-down window (contextIsolation, sandbox, no node). Load failure shows a local "Can't reach HiveOp — Retry" page that retries with backoff. User agent appends `HiveOpDesktop/<version>`. Stories 4, 5, 11, 24.

## Acceptance criteria

- [ ] `npm run dev` in desktop/ opens the live site signed-out and sign-in by email code works in the window
- [ ] Launching the app a second time focuses the first window; no second window ever appears
- [ ] Clicking an outside link in the site opens the system browser
- [ ] With network off, the Can't-reach page appears and recovers on its own when network returns
- [ ] Navigation policy has a table-driven unit test; GREEN = unit tests + typecheck + manual launch on this Mac

## Blocked by

None — can start immediately
