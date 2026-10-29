---
id: dsk-16
title: app update checks
type: AFK
status: done
blocked_by: [dsk-07]
parent: docs/prd/desktop-app.md
repo: hiveop-apps
---

## What to build

Shell checks GitHub Releases at start and daily. Windows/Linux: electron-updater downloads and installs on restart. Mac (unsigned): "Update available" in the tray and a site toast linking the download. Story 34.

## Acceptance criteria

- [ ] A newer release is detected on each OS build
- [ ] Windows/Linux builds install on restart (Linux verified in Docker)
- [ ] Mac shows the download link
- [ ] GREEN = unit test for version compare + Linux Docker run

## Blocked by

- dsk-07
