#!/usr/bin/env bash
# Runs src/fixtures/universalLink.cases.json through the iOS UniversalLink rule (UniversalLink.swift).
# macOS + Xcode only.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
{ echo "import Foundation"; awk '/^enum PushPath/,/^}/' "$here/ios/App/App/PushTap.swift"; } > "$tmp/pp.swift"
cp "$here/ios/App/App/UniversalLink.swift" "$tmp/ul.swift"
swiftc "$tmp/pp.swift" "$tmp/ul.swift" "$here/scripts/swift-check/universallink/main.swift" -o "$tmp/ulcheck"
"$tmp/ulcheck" "$here/src/fixtures/universalLink.cases.json"
rm -rf "$tmp"
