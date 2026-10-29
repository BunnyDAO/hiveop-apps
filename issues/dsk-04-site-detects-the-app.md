---
id: dsk-04
title: site detects the app
type: AFK
status: done
blocked_by: [dsk-01]
parent: docs/prd/desktop-app.md
repo: hiveop-apps + wenrwa-arena
---

## What to build

Preload exposes one object `window.hiveopDesktop` = `{version, capabilities[], …}` only when the top frame origin is the configured site; every call validates arguments. In the site, one pure module reads it and returns typed capabilities; no other site file touches the global. Help shows the app version when in the app. The install/PWA banner never shows inside the app. Stories 3, 35.

## Acceptance criteria

- [ ] In the app, the site module reports version + capabilities; in a normal browser it reports `null`
- [ ] The object is absent when the window is on any other origin
- [ ] Help shows "HiveOp app <version>" only in the app
- [ ] No install banner inside the app
- [ ] GREEN = arena tsc + eslint + vitest + next build; shell unit tests; manual check in the app against localhost:3000

## Blocked by

- dsk-01
