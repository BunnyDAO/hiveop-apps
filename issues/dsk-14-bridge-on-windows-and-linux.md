---
id: dsk-14
title: bridge on windows and linux
type: HITL
status: open
blocked_by: [dsk-03]
parent: docs/prd/desktop-app.md
repo: Wenrwa-Marketplace (CLI)
---

## What to build

Make the local bridge run local agents on Windows and Linux: shell selection, path handling, file modes, node-pty on each, no Mac-only assumptions in the managed path. Linux is verified in Docker here; Windows needs the owner (or someone) on a real Windows PC — hence HITL.

## Acceptance criteria

- [ ] Linux (Docker): managed bridge starts, a local agent terminal opens and runs claude
- [ ] CLI test suite passes with Windows/Linux path cases
- [ ] Owner runs a Windows smoke and reports
- [ ] GREEN = CLI tests + Linux Docker run; Windows by owner

## Blocked by

- dsk-03
