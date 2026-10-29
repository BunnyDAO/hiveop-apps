#!/usr/bin/env bash
# Build Linux (AppImage + deb) or Windows (NSIS) installers inside the electron-builder Docker images.
# Sources are copied into the container so the host's macOS node_modules never leak in.
set -euo pipefail
target="${1:?usage: dist-docker.sh linux|win}"
here="$(cd "$(dirname "$0")/.." && pwd)"
docker info >/dev/null 2>&1 || { echo "Docker is not running; cannot build $target" >&2; exit 2; }
case "$target" in
  linux) image=electronuserland/builder; flags="--linux --x64" ;;
  win)   image=electronuserland/builder:wine; flags="--win --x64" ;;
  *) echo "unknown target $target" >&2; exit 2 ;;
esac
mkdir -p "$here/release"
docker run --rm --platform linux/amd64 \
  -v "$here":/src:ro -v "$here/release":/out \
  -v hiveop-builder-electron-cache:/root/.cache/electron \
  -v hiveop-builder-eb-cache:/root/.cache/electron-builder \
  "$image" bash -c '
    set -euo pipefail
    mkdir /work && cd /src && tar cf - --exclude=node_modules --exclude=dist --exclude=release . | tar xf - -C /work
    cd /work && npm ci --no-audit --no-fund && npm run build
    # electron-builder runs the NSIS installer under wine to extract the uninstaller. Wine cannot run under
    # qemu emulation (Apple Silicon Docker without Rosetta); electron-builder has a wine-free reader for this
    # (its macOS Catalina path), so force it in the throwaway /work copy when wine is unusable.
    if [ "'"$target"'" = win ] && ! wine cmd /c echo ok >/dev/null 2>&1; then
      echo "wine is not usable here; using electron-builder wine-free uninstaller reader"
      sed -i "s/(0, macosVersion_1.isMacOsCatalina)()/true/" node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js
    fi
    npx electron-builder '"$flags"' -c.directories.output=/out
  '
