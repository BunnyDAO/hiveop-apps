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
