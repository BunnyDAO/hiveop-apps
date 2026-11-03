#!/usr/bin/env bash
# Writes android/app/google-services.json (Firebase project "hiveop", app io.hiveop.app).
# Needs `firebase login` once. The file is gitignored; without it the Android build still
# succeeds and the app simply has no push (the site sees no `push` capability).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
log="$(mktemp -d)"
cd "$log" # firebase-debug.log lands here, not in the repo
npx -y firebase-tools apps:sdkconfig ANDROID 1:992764055391:android:0fdce4957e59e8c2f9b0ea \
  --project hiveop > "$here/android/app/google-services.json.tmp"
mv "$here/android/app/google-services.json.tmp" "$here/android/app/google-services.json"
rm -rf "$log"
echo "android/app/google-services.json written (gitignored)"
