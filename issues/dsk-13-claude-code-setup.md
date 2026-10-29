---
id: dsk-13
title: claude code setup
type: AFK
status: open
blocked_by: [dsk-10]
parent: docs/prd/desktop-app.md
repo: hiveop-apps + wenrwa-arena
---

## What to build

Capability `claude-setup`. On a local agent start, if `claude` is not on the resolved PATH, the shell installs Anthropic's official `@anthropic-ai/claude-code` into the app tools folder; the pane shows "Setting up Claude Code…" then the agent starts and the normal Anthropic login appears in the terminal. An existing install is used as is. Missing git → pane message with how to get it (Mac: the system developer-tools prompt). Stories 31–33.

## Acceptance criteria

- [ ] With claude absent: first local agent installs it and starts
- [ ] With claude present: no install, user's version used
- [ ] Install failure: pane shows the error and a Try again button
- [ ] Missing git: clear message
- [ ] GREEN = provisioner unit tests (found/missing/fail) + manual run with claude hidden from PATH

## Blocked by

- dsk-10
