---
id: dsk-03
title: bridge version and managed mode
type: AFK
status: done
blocked_by: []
parent: docs/prd/desktop-app.md
repo: Wenrwa-Marketplace (CLI)
---

## What to build

`GET /discovery` gains a `version` field (additive). A managed mode (`--managed` flag or env) tells the bridge it is owned by the desktop app: it takes its connect token from the app (env/stdin, never argv or disk in clear), never runs the interactive pairing prompt, never falls back to npx, and writes logs to a path the app names. Publishing the CLI needs the owner's OK at the time. Stories 26, 35.

## Acceptance criteria

- [ ] /discovery returns `version` equal to the package version
- [ ] In managed mode with a token supplied, the bridge starts with no prompt and no npx fallback
- [ ] In managed mode without a token, it exits non-zero with a clear message instead of prompting
- [ ] Token never appears in process args, logs, or plist
- [ ] GREEN = CLI tests + tsc

## Blocked by

None — can start immediately
