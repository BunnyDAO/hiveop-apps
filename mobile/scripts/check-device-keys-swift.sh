#!/usr/bin/env bash
# ryc-09: type-checks the Secure Enclave key code (enum DeviceKeys in HiveOpShell.swift) on its own,
# against the macOS SDK. Type-check only: it never creates or touches a key. macOS + Xcode only.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
{
  echo "import Foundation"
  echo "import LocalAuthentication"
  echo "import Security"
  grep '^struct DeviceKeyError' "$here/ios/App/App/HiveOpShell.swift"
  awk '/^enum DeviceKeys/,/^}/' "$here/ios/App/App/HiveOpShell.swift"
} > "$tmp/dk.swift"
swiftc -typecheck "$tmp/dk.swift"
echo "DeviceKeys type-checks"
rm -rf "$tmp"
