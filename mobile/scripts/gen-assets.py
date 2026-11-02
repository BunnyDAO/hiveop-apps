"""Regenerates the app icon and splash art (dark background + cyan hexagon ring).
Run: python3 -I scripts/gen-assets.py   (needs Pillow). Output is committed."""
import glob, os
from PIL import Image, ImageDraw

BG = (11, 13, 18)
CYAN = (31, 196, 238)
OUTER = [(512, 260), (728, 386), (728, 638), (512, 764), (296, 638), (296, 386)]
INNER = [(512, 374), (631, 443), (631, 581), (512, 650), (393, 581), (393, 443)]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def hexagon(size, scale=1.0, bg=BG, fg=CYAN, transparent=False):
    """Square canvas `size`; hexagon ring drawn at `scale` of the 1024 reference."""
    ss = 4  # supersample
    n = size * ss
    mode = "RGBA" if transparent else "RGB"
    img = Image.new(mode, (n, n), (0, 0, 0, 0) if transparent else bg)
    d = ImageDraw.Draw(img)
    k = n / 1024 * scale
    off = n * (1 - scale) / 2
    pt = lambda p: (p[0] * k + off, p[1] * k + off)
    d.polygon([pt(p) for p in OUTER], fill=fg)
    d.polygon([pt(p) for p in INNER], fill=(0, 0, 0, 0) if transparent else bg)
    return img.resize((size, size), Image.LANCZOS)


def splash(w, h):
    base = Image.new("RGB", (w, h), BG)
    s = int(min(w, h) * 0.30)
    mark = hexagon(s, scale=1.8)  # tighten the reference's margin
    base.paste(mark, ((w - s) // 2, (h - s) // 2))
    return base


res = os.path.join(ROOT, "android/app/src/main/res")
for p in glob.glob(res + "/drawable*/splash.png"):
    w, h = Image.open(p).size
    splash(w, h).save(p)

for p in glob.glob(res + "/mipmap-*/ic_launcher*.png"):
    sz = Image.open(p).size[0]
    name = os.path.basename(p)
    if name == "ic_launcher_foreground.png":
        hexagon(sz, scale=1.0, transparent=True).save(p)  # adaptive: transparent, safe zone
    else:
        hexagon(sz, scale=1.55).save(p)

ios = os.path.join(ROOT, "ios/App/App/Assets.xcassets")
hexagon(1024, scale=1.55).save(ios + "/AppIcon.appiconset/AppIcon-512@2x.png")
for p in glob.glob(ios + "/Splash.imageset/*.png"):
    splash(2732, 2732).save(p)
print("assets regenerated")
