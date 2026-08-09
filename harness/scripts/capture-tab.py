"""
Capture a full test tab as one tall image.

adb screencap only captures the visible screen, so this scrolls the tab from
top to bottom, grabs a frame per step, and stitches them into a single image
with overlaps removed.

Usage:
    python scripts/capture-tab.py <output-name> [--device SERIAL] [--max-steps N]

The scroll region and chrome heights are tuned for the test app's layout
(header + tab bar at the top). Deduplication is content-based: if a new frame's
body is identical to the previous one, we have hit the bottom and stop.
"""

import subprocess
import sys
import os
import tempfile
from PIL import Image

DEVICE = None
# App chrome: status bar + header + tab bar. Content starts below this.
CHROME_TOP = 320
# Bottom nav bar / gesture area to trim from each frame.
CHROME_BOTTOM = 120
# How far to swipe per step (px). Smaller = more overlap = safer stitching.
SCROLL_STEP = 900
MAX_STEPS = 14


def adb(*args, capture=False):
    cmd = ["adb"]
    if DEVICE:
        cmd += ["-s", DEVICE]
    cmd += list(args)
    env = dict(os.environ, MSYS_NO_PATHCONV="1")
    if capture:
        return subprocess.run(cmd, capture_output=True, env=env).stdout
    subprocess.run(cmd, capture_output=True, env=env)


def grab(path):
    adb("shell", "screencap", "-p", "/sdcard/__cap.png")
    adb("pull", "/sdcard/__cap.png", path)
    return Image.open(path).convert("RGB")


def body(img):
    """The scrollable region of a frame, with app chrome removed."""
    w, h = img.size
    return img.crop((0, CHROME_TOP, w, h - CHROME_BOTTOM))


def main():
    global DEVICE
    args = sys.argv[1:]
    if not args:
        print("usage: capture-tab.py <output-name> [--device SERIAL] [--max-steps N]")
        sys.exit(1)

    name = args[0]
    max_steps = MAX_STEPS
    if "--device" in args:
        DEVICE = args[args.index("--device") + 1]
    if "--max-steps" in args:
        max_steps = int(args[args.index("--max-steps") + 1])

    tmp = tempfile.mkdtemp()
    frames = []

    # Scroll to the very top first so captures are deterministic.
    for _ in range(12):
        adb("shell", "input", "swipe", "540", "800", "540", "2000", "60")

    prev_body = None
    for step in range(max_steps):
        img = grab(os.path.join(tmp, f"f{step}.png"))
        b = body(img)

        if prev_body is not None and list(b.getdata()) == list(prev_body.getdata()):
            print(f"  reached bottom at step {step}")
            break

        frames.append(b)
        prev_body = b
        print(f"  captured frame {step + 1}")

        adb("shell", "input", "swipe", "540", "1800", "540", str(1800 - SCROLL_STEP), "260")
        # Let the scroll settle and any lazy content render.
        subprocess.run(["sleep", "1"], capture_output=True)

    if not frames:
        print("no frames captured")
        sys.exit(1)

    width = frames[0].width
    total = sum(f.height for f in frames)
    out = Image.new("RGB", (width, total), "white")
    y = 0
    for f in frames:
        out.paste(f, (0, y))
        y += f.height

    dest = os.path.join("screenshots", f"{name}.png")
    os.makedirs("screenshots", exist_ok=True)
    out.save(dest)
    print(f"saved {dest}  ({width}x{total}, {len(frames)} frames)")


if __name__ == "__main__":
    main()
