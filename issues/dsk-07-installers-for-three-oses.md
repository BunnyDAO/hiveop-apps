---
id: dsk-07
title: installers for three oses
type: AFK
status: done
blocked_by: [dsk-01]
parent: docs/prd/desktop-app.md
repo: hiveop-apps
---

## What to build

electron-builder config: Mac universal dmg (unsigned), Windows NSIS x64 built in the electron-builder Wine Docker image, Linux AppImage + deb x64 built in Docker. `hiveop://` registered on each. Signing/notarization config present but off. A single `npm run dist` builds all three on this Mac. Stories 36, 37.

## Acceptance criteria

- [ ] `npm run dist` produces dmg, exe, AppImage, deb
- [ ] The dmg installs and opens on this Mac (Gatekeeper right-click Open)
- [ ] The AppImage launches under Xvfb in Docker and loads the site
- [ ] The Windows build completes; release notes mark it untested on real Windows
- [ ] GREEN = the four artifacts exist + the two smoke runs

## Blocked by

- dsk-01
