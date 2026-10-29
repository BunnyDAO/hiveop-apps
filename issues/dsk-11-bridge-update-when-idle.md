---
id: dsk-11
title: bridge update when idle
type: AFK
status: done
blocked_by: [dsk-10]
parent: docs/prd/desktop-app.md
repo: hiveop-apps
---

## What to build

Hourly npm check for a newer CLI; download + verify in the background; swap only when zero local agents are running, else at next app start. Tray shows "Bridge update ready". Failed new version (crash on start) rolls back to the previous. Story 30.

## Acceptance criteria

- [ ] A newer version with an agent running: waits; after the agent stops, swaps and restarts
- [ ] At app start a pending version is used
- [ ] A new version that crashes at start rolls back
- [ ] GREEN = installer/supervisor unit tests with a fake registry

## Blocked by

- dsk-10
