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

- [x] Linux (Docker): managed bridge starts, a local agent terminal opens and runs claude (2026-10-31, node:22 amd64; MCP registered via claude)
- [x] CLI test suite passes with Windows/Linux path cases (Marketplace 4993052f: windowsSpawn, slug, .env names; 2024 pass)
- [ ] Owner runs a Windows smoke and reports
- [ ] GREEN = CLI tests + Linux Docker run; Windows by owner

## Blocked by

- dsk-03

## Notes (2026-10-31)

- Fixed: claude.cmd spawn + `claude mcp` on Windows; Git Bash SHELL; Windows session slug; Windows env names in .env; Linux menu launch with no SHELL (hiveop-apps d1a3446).
- Ships to users only with a CLI release (0.8.17), since the app installs dist-tag latest.
- Not done (degrades, doesn't block): login autostart off-Mac (the app runs the bridge anyway), screenshot drop off-Mac, opencode on Windows, kdialog folder picker, hook commands need `node` on the hook shell's PATH on Windows.
