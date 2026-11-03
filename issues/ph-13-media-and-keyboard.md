---
id: ph-13
title: Mic, camera, photos and terminal keyboard in both apps
type: AFK
status: done
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

## Done (2026-11-02)

Branch valk/ph13. Mic/camera answered for the site origin only, after the OS grant (Android: `SiteWebChromeClient` over Capacitor's client; iOS: `MediaGate` WKUIDelegate wrapper in `MainViewController`). Rule + shared fixture: `mobile/src/mediaPolicy.ts`, `MediaPolicy.java`. Usage strings and RECORD_AUDIO/CAMERA added. Keyboard: Android `adjustResize` (layout viewport shrinks, as Chrome); iOS no resize (visualViewport shrinks, as Safari), no Keyboard plugin. Verified headless on a Pixel emulator and iPhone 17 simulator against a local test page. Not driven: iOS file picker and camera-capture inputs (no tap tool); owner drill folds into ph-15.
