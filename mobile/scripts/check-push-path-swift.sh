#!/usr/bin/env bash
# Runs src/fixtures/pushPath.cases.json through the iOS PushPath rule (PushTap.swift), as the
# Android unit test does for Java. macOS + Xcode only.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
{ echo "import Foundation"; awk '/^enum PushPath/,/^}/' "$here/ios/App/App/PushTap.swift"; } > "$tmp/pp.swift"
swiftc "$tmp/pp.swift" "$here/scripts/swift-check/pushpath/main.swift" -o "$tmp/ppcheck"
"$tmp/ppcheck" "$here/src/fixtures/pushPath.cases.json"
rm -rf "$tmp"
