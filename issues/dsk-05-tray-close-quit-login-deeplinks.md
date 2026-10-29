---
id: dsk-05
title: tray close quit login deeplinks
type: AFK
status: open
blocked_by: [dsk-01]
parent: docs/prd/desktop-app.md
repo: hiveop-apps
---

## What to build

Menu-bar / tray icon with Open HiveOp, Start at login (on by default), Quit. Closing the window hides to tray. Quit confirms "Stop N local agents?" when the shell reports running local agents (count wired in dsk-10; until then N=0 and Quit is immediate). `hiveop://` registered; opening a `hiveop://open?path=/…` link focuses the one window and navigates it to that site path (path only, never another origin). Stories 6, 7, 9, 10.

## Acceptance criteria

- [ ] Closing the window leaves the tray icon; Open HiveOp brings it back
- [ ] `open hiveop://open?path=/fleet` focuses and navigates the existing window
- [ ] A `hiveop://` link with an absolute or foreign URL is ignored
- [ ] Start-at-login toggle registers/unregisters the OS login item
- [ ] GREEN = unit tests for deep-link parsing + manual run on this Mac

## Blocked by

- dsk-01
