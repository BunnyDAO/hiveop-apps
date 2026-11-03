# HiveOp phone shell (Capacitor)

`npm run sync` builds the offline page and shell asset, then `cap sync`.

## Push notifications

- Android: `npm run fetch:firebase` writes `android/app/google-services.json` (gitignored; needs `firebase login`).
  Without it the build still succeeds and the app has no push (the site does not see the `push` capability).
- iOS: `ios/App/App/App.entitlements` carries `aps-environment`. The Push Notifications capability must be
  enabled on the `io.hiveop.app` id in the owner's Apple developer account before a device build is signed.
- Backend needs `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_P8` (+ `APNS_ENV`) and `FCM_SERVICE_ACCOUNT_JSON`.
- Try a tap on a simulator: `xcrun simctl push <device> io.hiveop.app payload.json` with
  `{"aps":{"alert":{"title":"t","body":"b"},"badge":2},"path":"/inbox"}`.
