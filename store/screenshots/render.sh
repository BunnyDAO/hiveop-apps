#!/bin/sh
# render.sh <shot.png> <title "plain|accent"> <w> <h> <out.png>
# One hidden headless Chrome per frame, throwaway profile, exits on its own.
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DIR=$(cd "$(dirname "$0")" && pwd)
PROF=$(mktemp -d)
T=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$2")
URL="file://$DIR/frame.html?w=$3&h=$4&title=$T&shot=file://$1"
"$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --user-data-dir="$PROF" --allow-file-access-from-files --virtual-time-budget=3000 \
  --window-size="$3,$4" --screenshot="$5" "$URL" >/dev/null 2>&1
rm -rf "$PROF"
