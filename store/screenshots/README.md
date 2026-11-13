# Screenshots (2026-11-04)

Method: the site (https://app.hiveop.io), not the native app. Headless Chrome (CDP, hidden, one process per shot, killed by PID) with device-metrics emulation at the CSS size x scale below. No login, no personal data. The native shell was not built here (another agent owns mobile/ build config).

| Folder | Pixels | Store spec |
|---|---|---|
| ios/iphone-6.9 | 1320x2868 | iPhone 6.9" accepted: 1260x2736, 1290x2796, 1320x2868 |
| ios/ipad-13 | 2064x2752 | iPad 13": 2064x2752 or 2048x2732 (required, app runs on iPad) |
| android/phone | 1080x2400 | 320-3840 px, 16:9 to 9:16 max ratio 2:1, PNG no alpha, min 2 |
| android/tablet-10 | 1600x2560 | 10" tablet: 1080-7680 px, min 4 recommended |

Sources: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications , https://support.google.com/googleplay/android-developer/answer/9866151

These are placeholders only: the signed-out site is a sign-in card and a tagline. Store-ready shots (Inbox with a needs-you item, terminals, chat, work graph) need the demo account from review-notes.md; rerun with the same method once it exists. Apple requires 1-10 per size, Play wants at least 4 per tablet size.

## Framed store set (2026-11-06)

`ios/iphone-6.9/framed/01-05.png` (1320x2868) and `android/phone/framed/01-05.png` (1080x2160, Play max 2:1). Raw shots come from the iOS Simulator signed in as the review account. To re-render: `./render.sh <shot.png> "plain|accent" <w> <h> <out.png>` (template `frame.html`, one hidden headless Chrome per frame). Order: 1 agent, 2 home, 3 mission, 4 chat, 5 report/block. Older 1080x2400 Android placeholders break Play's 2:1 rule; don't upload them.

iPad 13" (2026-11-08): `ios/ipad-13/framed/01-scene.png` (terminal + 3D Scene, "Watch your agents / work in 3D") and `02-canvas.png` (terminal + Chat), 2064x2752; unframed originals in `ios/ipad-13/raw/`. `frame.html` gives tablet-shaped canvases (wider than 0.6) tighter corners so the status bar isn't clipped. The earlier iPad placeholders (sign-in, home) were removed.

## New design set (2026-11-12)

`2026-11-12/{ios-6.3,ipad-13,play-phone}/{raw,framed}`, from the phone + tablet redesign on arena master (23c87427). Not taken on prod: a local dev server with a headless CDP harness serving demo fixtures (Qubit Forge, Hyperion, agents Ada / Grace; a fake terminal relay feeds the agent pane). No sign-in, no real accounts. The status bar (9:41, full battery) is drawn by the harness; the clock's timezone is pinned so chat times sit just before 9:41.

| Folder | Pixels | Shots |
|---|---|---|
| ios-6.3 | 1206x2622 (402x874 @3x) | 01 home, 02 agent, 03 mission, 04 chat, 05 report/block, 06 agents |
| ipad-13 | 2752x2064 landscape, 2064x2752 portrait (@2x) | 01 Commander + Scene (landscape), 02 terminal over chat (portrait) |
| play-phone | 1080x2160 (360x720 @3x, Play max 2:1) | same six as iOS, Android-style status bar |

05 is the moderation shot App Review and Play's UGC policy look for. `frame.html` now handles landscape canvases (headline sized off the short side, shot width capped).
