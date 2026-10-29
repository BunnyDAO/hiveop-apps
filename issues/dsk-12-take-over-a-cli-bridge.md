---
id: dsk-12
title: take over a cli bridge
type: AFK
status: open
blocked_by: [dsk-10]
parent: docs/prd/desktop-app.md
repo: hiveop-apps + wenrwa-arena
---

## What to build

When a bridge already answers on 8377 and is not the managed one, the shell reports running(cli) and the site shows a one-time "Let HiveOp manage your bridge?" banner. Yes → remove the `com.wenrwa.bridge` LaunchAgent (Mac), wait for zero running local agents, stop the CLI bridge, start the managed one (agents resume by session id). No → remembered; never asked again. Stories 27–29.

## Acceptance criteria

- [ ] With a CLI bridge running, the app uses it and shows the banner once
- [ ] Yes with no agents running: plist removed, managed bridge running, local terminals reattach
- [ ] Yes with an agent running: waits, then switches
- [ ] No: nothing changes, no banner after restart
- [ ] GREEN = supervisor tests for the takeover states + manual run on this Mac

## Blocked by

- dsk-10
