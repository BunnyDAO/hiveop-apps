---
id: ph-01
title: The phone app opens the site
type: AFK
status: done
blocked_by: []
parent: docs/prd/phone-apps.md
repo: hiveop-apps
---

## What to build

A Capacitor project in `mobile/` (sibling to `desktop/`) for iOS and Android that loads app.hiveop.io (overridable for staging/dev). App id `io.hiveop.app`, name "HiveOp", universal iPhone+iPad, Android phones+tablets; tablets rotate, phones portrait. Native splash in HiveOp dark with the hexagon (no white flash). Load failure shows a local "Can't reach HiveOp" page with Try again and auto-retry with backoff on network change. Resume keeps the page (no reload unless the OS killed it). User agent appends `HiveOpApp/<version> (<platform>)`. Navigation policy (pure module, shape like desktop navPolicy) with in-app and deny decisions wired; other decisions come in later slices. Site cookies/session persist across app restarts.

Covers user stories 1–7, 42.

## Acceptance criteria

- [ ] Android build runs in a headless emulator (`-no-window`): site loads, sign in by email code works, session survives app restart
- [ ] iOS build runs in a headless simulator (`simctl`, Simulator.app not opened): same checks (needs Xcode; blocked on owner's macOS 26.6+ update)
- [ ] Airplane mode → Can't reach HiveOp; network back → site loads without a tap
- [ ] iPad simulator at full width shows the desktop layout; phone shows the phone layout
- [ ] navPolicy unit tests; UA contains HiveOpApp/<version>
- [ ] No windows appear on the owner's screen during tests

## Blocked by

None — can start immediately

## Done (2026-11-02)

Landed 117abf3. Verified headless on iPhone 17 (iOS 26.5) and a Pixel 7 emulator (Android 15): site loads, storage survives terminate + relaunch, UA, offline page + auto-recovery, dark splash. Owner drill left (folded into ph-15): email-code sign-in in the app, iPad signed-in desktop layout, resume without reload.
