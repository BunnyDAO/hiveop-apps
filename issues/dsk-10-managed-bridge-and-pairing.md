---
id: dsk-10
title: managed bridge and pairing
type: AFK
status: open
blocked_by: [dsk-03, dsk-04, dsk-05]
parent: docs/prd/desktop-app.md
repo: hiveop-apps + wenrwa-arena (+ backend if a device-token mint is missing)
---

## What to build

Capability `managed-bridge`. Bridge supervisor (pure state machine: none → starting → running(managed) | running(cli), crashed(backoff)) and installer: fetch `@wenrwa/marketplace-cli` from npm into app data, verify sha512 integrity, unpack versioned, atomic `current` swap, keep previous for rollback. Run it with the app runtime as Node in managed mode, with the user's login-shell PATH (app tools folder first). The signed-in site mints a device connect token and hands it to the shell (stored with safeStorage). The site's "Start your local Terminal Bridge" overlay is replaced by the shell's bridge state. Tray shows bridge status and local-agent count; Quit confirms when N>0. Stories 8, 9, 26.

## Acceptance criteria

- [ ] Fresh Mac with no CLI: sign in, create/open a local workspace, start an agent — terminal works with no token pasted
- [ ] Integrity mismatch refuses the download and keeps the current version
- [ ] Killing the bridge process restarts it with backoff; tray shows state
- [ ] Quit with a running local agent asks to stop it
- [ ] GREEN = supervisor + installer unit tests + arena gate + manual run on this Mac

## Blocked by

- dsk-03
- dsk-04
- dsk-05
