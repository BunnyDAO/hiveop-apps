#!/usr/bin/env bash
# Runs src/fixtures/appleNonce.cases.json through the iOS AppleNonce rule (AppleSignIn.swift). macOS + Xcode only.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
{ echo "import Foundation"; echo "import Security"; echo "import CryptoKit"; awk '/^enum AppleNonce/,/^}/' "$here/ios/App/App/AppleSignIn.swift"; } > "$tmp/nonce.swift"
swiftc "$tmp/nonce.swift" "$here/scripts/swift-check/applenonce/main.swift" -o "$tmp/noncecheck"
"$tmp/noncecheck" "$here/src/fixtures/appleNonce.cases.json"
rm -rf "$tmp"
