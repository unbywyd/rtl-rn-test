#!/usr/bin/env bash
# Capture a screenshot from a physically connected iPhone.
#
# iOS 17+ moved the developer services behind an RSD tunnel, so the classic
# `idevicescreenshot` fails with "Invalid service" even when Developer Mode is
# on and a DDI is mounted. `xcrun devicectl` has no screenshot command at all.
#
# pymobiledevice3 can reach the service, and `--userspace` opens the tunnel
# WITHOUT root — no sudo, no background daemon, so this runs unattended.
#
# Usage:
#     scripts/ios-screenshot.sh <output-name>    -> screenshots/<name>.png
#
# Requires: pip3 install pymobiledevice3 ; Developer Mode enabled on device.

set -euo pipefail

NAME="${1:-}"
if [ -z "$NAME" ]; then
  echo "usage: ios-screenshot.sh <output-name>" >&2
  exit 1
fi

mkdir -p screenshots
DEST="screenshots/${NAME}.png"

# 2>/dev/null drops the LibreSSL/urllib3 warning python emits on macOS system python.
python3 -m pymobiledevice3 developer dvt screenshot "$DEST" --userspace 2>/dev/null

echo "saved $DEST"
python3 -c "from PIL import Image; i=Image.open('$DEST'); print(f'  {i.size[0]}x{i.size[1]}')"
