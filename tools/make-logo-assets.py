"""Derive every logo asset the site serves from the one master file.

`images/LOGO-2.png` is the master: a large, transparent-background PNG of the
flag-P mark. Shipping that 1245x1263 file to a 34px header slot wastes ~490KB
per visit and lets the browser pick the downscaler, so instead this script
exports a small ladder of exact sizes that the pages reference through srcset.

Three details matter for quality and weight:

  * Trim to the alpha bounding box first. The master carries transparent
    padding, so an untrimmed mark renders smaller than its box and never sits
    flush with the wordmark beside it.
  * Resize in premultiplied alpha ("RGBa"). Transparent pixels in the master
    are (0,0,0,0); averaging their RGB straight would draw a dark fringe
    around every edge at small sizes.
  * Try a 255-colour palette and keep it only when it is smaller. The mark is
    five flat flag colours plus antialiased edges, so a palette is visually
    lossless here (mean channel delta under 1/255) and cuts the largest export
    from 108KB to 15KB — but at 16px the palette table costs more than it
    saves, so each export keeps whichever encoding wins.

Run after replacing the master, then commit the generated files:

    python3 tools/make-logo-assets.py
"""

import io
import pathlib
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("needs Pillow:  python3 -m pip install pillow")

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMAGES = ROOT / "images"
MASTER = IMAGES / "LOGO-2.png"

# Heights the pages actually ask for, each at 1x/2x/3x. The header draws the
# mark at 34px, the footer brand at 44px, the opener at up to 132px.
MARK_HEIGHTS = [64, 128, 256, 512]

# Square icons. Browsers render these at 16-48px, so they get their own
# exports rather than a downscale of the tall mark.
FAVICON_SIZES = [16, 32, 48]
ICO_SIZES = [16, 32, 48]
APPLE_TOUCH = 180

# The mark is taller than it is wide, so a square icon needs padding to avoid
# a cramped fit. Cream matches --bg; iOS composites Apple touch icons on black
# otherwise, which buries the navy.
ICON_PAD = 0.06
APPLE_PAD = 0.14
APPLE_BG = (250, 250, 247, 255)

# The social card has its type baked in, so the mark is swapped in place rather
# than the card being redrawn. PATCH is the rectangle wiped first — generous
# enough to clear the old emblem, and clear of the headline below it. The mark
# then lands at MARK_POS with its left ink on the card's 80px text margin and
# its band matching the emblem it replaces, so nothing else has to move.
# Constants, not detection, so re-running this is idempotent.
OG_IMAGE = IMAGES / "og-image.jpg"
OG_PATCH = (74, 66, 196, 184)
OG_MARK_POS = (80, 73)
OG_MARK_HEIGHT = 100
OG_QUALITY = 92


def trimmed_master():
    im = Image.open(MASTER).convert("RGBA")
    box = im.getchannel("A").getbbox()
    if box is None:
        sys.exit("master is fully transparent")
    return im.crop(box)


def scale(im, size):
    """Downscale without edge fringing, by resizing premultiplied."""
    return im.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def palettize(im):
    """Flat flag colours compress far better as a palette than as truecolour."""
    return im.quantize(colors=255, method=Image.FASTOCTREE)


def height_to_size(im, height):
    w, h = im.size
    return max(1, round(w * height / h)), height


def fit_square(im, side, pad, background=None):
    """Center the mark in a square canvas, inset by `pad` on the tight side."""
    inner = round(side * (1 - 2 * pad))
    w, h = im.size
    if w >= h:
        size = (inner, max(1, round(h * inner / w)))
    else:
        size = (max(1, round(w * inner / h)), inner)
    mark = scale(im, size)

    canvas = Image.new("RGBA", (side, side), background or (0, 0, 0, 0))
    canvas.alpha_composite(mark, ((side - size[0]) // 2, (side - size[1]) // 2))
    return canvas


def encode(im, **kw):
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True, **kw)
    return buf.getvalue()


def save(im, name, **kw):
    """Write the smaller of the truecolour and palette encodings."""
    best = min(encode(im, **kw), encode(palettize(im), **kw), key=len)
    path = IMAGES / name
    path.write_bytes(best)
    print(f"  {name:26s} {im.size[0]:4d}x{im.size[1]:<4d} {len(best) / 1024:7.1f} KB")


def patch_og_image(master):
    """Swap the mark on the social card, leaving its baked-in type untouched."""
    if not OG_IMAGE.exists():
        print(f"  {'og-image.jpg':26s} skipped (missing)")
        return

    card = Image.open(OG_IMAGE).convert("RGB")
    x0, y0, x1, y1 = OG_PATCH

    # Sample the card's own background just right of the patch rather than
    # assuming --bg, so the fill matches after JPEG has shifted the tone.
    card.paste(card.getpixel((x1 + 40, y0 + 10)), OG_PATCH)

    mark = scale(master, height_to_size(master, OG_MARK_HEIGHT))
    card.paste(mark, OG_MARK_POS, mark)
    card.save(OG_IMAGE, quality=OG_QUALITY, optimize=True, progressive=True)
    print(f"  {'og-image.jpg':26s} {card.size[0]:4d}x{card.size[1]:<4d}"
          f" {OG_IMAGE.stat().st_size / 1024:7.1f} KB")


def main():
    if not MASTER.exists():
        sys.exit(f"missing master: {MASTER.relative_to(ROOT)}")

    master = trimmed_master()
    print(f"master trimmed to {master.size[0]}x{master.size[1]}\n")

    print("mark:")
    for height in MARK_HEIGHTS:
        save(scale(master, height_to_size(master, height)), f"logo-mark-{height}.png")

    print("favicons:")
    for side in FAVICON_SIZES:
        save(fit_square(master, side, ICON_PAD), f"favicon-{side}.png")

    icons = [fit_square(master, s, ICON_PAD) for s in ICO_SIZES]
    icons[-1].save(IMAGES / "favicon.ico", sizes=[(s, s) for s in ICO_SIZES])
    print(f"  {'favicon.ico':26s} {'/'.join(str(s) for s in ICO_SIZES):9s}"
          f" {(IMAGES / 'favicon.ico').stat().st_size / 1024:7.1f} KB")

    save(fit_square(master, APPLE_TOUCH, APPLE_PAD, APPLE_BG).convert("RGB"),
         "apple-touch-icon.png")

    print("social card:")
    patch_og_image(master)


if __name__ == "__main__":
    main()
