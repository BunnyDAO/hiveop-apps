---
id: ph-13
title: Mic, camera, photos and terminal keyboard in both apps
type: AFK
status: open
blocked_by: [ph-01]
parent: docs/prd/phone-apps.md
repo: hiveop-apps
---

## What to build

iOS usage strings for microphone, camera and photo library; Android RECORD_AUDIO/CAMERA with the WebView granting getUserMedia only to the site origin after the OS grant. File inputs open the native picker. Keyboard resize mode chosen so the site's visualViewport-based terminal typing and composer behave as in the phone browser.

Covers user stories 36–37.

## Acceptance criteria

- [ ] Emulator/simulator with fake audio: dictation starts after granting the mic; denied → the site's normal denied state
- [ ] Profile photo picker opens; upload works
- [ ] Terminal typing field and composer stay above the keyboard (screenshot check)

## Blocked by

- ph-01
