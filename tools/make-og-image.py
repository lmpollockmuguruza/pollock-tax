"""Draw images/og-image.jpg — the card social platforms show when a page is shared.

The card is the hero, condensed. The site opens with its headline on the left
and a pair of overlapping photographs on the right — Madrid over New York, the
two-systems premise made visual before a word is read — and that composition
is the most recognisable thing the site has. A shared link that looks like it
reproduces it in a feed; the earlier card, three quarters of it empty cream,
did not.

It also earns its place in a feed. A link preview is seen small and for about
a second: photographs stop a scroll where flat type does not, the brand
lockup carries the name at any size, and the headline is set large enough to
survive being rendered at 500px wide. The supporting line is two lines rather
than three because a third would not be legible there anyway.

Panel geometry, radius, ring and filter all come from .hero-image-showcase in
styles.css, so the card and the hero stay the same picture. Copy lives in COPY
below, and Satoshi is fetched from the host the pages load it from — the card
this replaces was set in DejaVu Sans, because whatever drew it ran somewhere
Satoshi was missing and the fallback was silent.

The pages carry an og:image:alt describing this card. It is written there, not
here, so there is one copy of it — but it does need editing when the headline
below does.

Run after editing the copy, or after the mark or hero photographs change:

    python3 tools/make-logo-assets.py      # first: refreshes the mark
    python3 tools/make-og-image.py

Needs Pillow and network access. Neither is needed to serve the site.
"""

import io
import pathlib
import re
import sys
import time
import urllib.request

try:
    from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont
except ImportError:
    sys.exit("needs Pillow:  python3 -m pip install pillow")

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMAGES = ROOT / "images"
OUTPUT = IMAGES / "og-image.jpg"
MARK = IMAGES / "logo-mark-512.png"
PHOTO_FRONT = IMAGES / "hero-spain.jpg"   # .img-panel-1 — Madrid, on top
PHOTO_BACK = IMAGES / "hero-usa.jpg"      # .img-panel-2 — New York, behind

# ---------------------------------------------------------------- copy -------
# The headline breaks on three lines and the summary on two, as written here:
# breaks are manual so they fall where they read best. Keep to those counts —
# the column is measured for them, and a fourth line would crowd the footline.
COPY = {
    "wordmark": "PollockTax",
    "headline": [
        "U.S. and Spanish",
        "taxes, handled",
        "with care.",
    ],
    "summary": [
        "One advisor for both sides — federal returns,",
        "FBAR, FATCA, Modelo 100 and Modelo 720.",
    ],
    "footline": "pollocktax.com · Madrid",
}

# --------------------------------------------------------------- design ------
SIZE = (1200, 630)          # 1.91:1, what Facebook, LinkedIn and X all expect
MARGIN = 80

# Tokens copied from :root in styles.css.
BG = (250, 250, 247)
INK = (10, 18, 38)
INK_3 = (90, 100, 120)
ACCENT = (10, 49, 97)       # Old Glory Blue
US_RED = (179, 25, 66)      # Old Glory Red
ES_RED = (170, 21, 27)      # Spanish flag red
ES_GOLD = (241, 191, 0)     # Spanish flag yellow

# Flag bar. The left 600px carries the U.S. colours and the right 600px
# Spain's, so the two-system premise reads before a word does.
BAR_HEIGHT = 6
BAR = [(395, ACCENT), (205, US_RED), (335, ES_RED), (265, ES_GOLD)]

# Photo mosaic, from .hero-image-showcase: a square box on a 12-column grid,
# each panel spanning 8 of 12 and the back one offset by 4.
SHOWCASE_BOX = 446
SHOWCASE_TOP = 92
PANEL_SPAN = 8 / 12
PANEL_OFFSET = 4 / 12
PANEL_RADIUS = 6            # --radius-md
PANEL_RING = 7              # .img-panel-1's ring, in the page colour
SHADOW_OFFSET = (0, 8)      # box-shadow: 0 8px 32px rgba(0,0,0,.06)
SHADOW_BLUR = 16            # a CSS blur radius of 32 is a sigma of 16
SHADOW_ALPHA = 0.06
PHOTO_GRAYSCALE = 0.1       # filter: grayscale(.1) contrast(1.02)
PHOTO_CONTRAST = 1.02

# Text column. It runs from the top of the mosaic to its bottom edge, so the
# two halves of the card start and finish together.
COLUMN = 540
COLUMN_BOTTOM = SHOWCASE_TOP + SHOWCASE_BOX

MARK_HEIGHT = 52
WORDMARK_CAP = 22
WORDMARK_GAP = 13           # .logo's gap between mark and word
WORDMARK_TRACKING = -0.018  # .logo-word

# Blocks are sized by cap height and anchored by the cap top of their first
# line. Both are what the eye reads as the type's size and top edge, and
# neither is a fixed fraction of the em: cap-to-em differs enough between faces
# that a pixel size copied from another one lands visibly off.
HEADLINE_CAP_TOP = 215
HEADLINE_CAP = 50
HEADLINE_LEADING = 62
HEADLINE_TRACKING = -0.024  # .display-1

SUMMARY_CAP_TOP = 442
SUMMARY_CAP = 17
SUMMARY_LEADING = 29
SUMMARY_TRACKING = -0.006

FOOTLINE_CAP = 16
FOOTLINE_TRACKING = 0

QUALITY = 88

FONT_CSS = "https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap"
FETCH_ATTEMPTS = 4          # a dropped connection is not a missing font


# ----------------------------------------------------------------- type ------
def fetch(url):
    """GET with a few retries — a reset mid-transfer is worth another go, and
    the alternative here is refusing to draw the card at all."""
    for attempt in range(1, FETCH_ATTEMPTS + 1):
        try:
            return urllib.request.urlopen(url, timeout=30).read()
        except OSError as err:
            if attempt == FETCH_ATTEMPTS:
                sys.exit(f"could not fetch Satoshi after {FETCH_ATTEMPTS} attempts ({err}).\n"
                         "Refusing to draw a card in a fallback face — check network access.")
            print(f"  fetch failed ({err}); retrying {attempt}/{FETCH_ATTEMPTS - 1}")
            time.sleep(2 ** attempt)


def satoshi(weights=(400, 500)):
    """Fetch Satoshi from the host the site loads it from, keyed by weight.

    Pillow cannot read woff2, so this picks the .ttf alternative out of the
    same stylesheet the pages link. Failure is fatal rather than warned about:
    a card that quietly falls back to a system face is the bug this replaces.
    """
    css = fetch(FONT_CSS).decode()

    faces = {}
    for block in re.findall(r"@font-face\s*\{.*?\}", css, re.S):
        url = re.search(r"url\('(//[^']+\.ttf)'\)", block)
        weight = re.search(r"font-weight:\s*(\d+)", block)
        style = re.search(r"font-style:\s*(\w+)", block)
        if url and weight and (style.group(1) if style else "normal") == "normal":
            faces[int(weight.group(1))] = "https:" + url.group(1)

    missing = [w for w in weights if w not in faces]
    if missing:
        sys.exit(f"Satoshi stylesheet has no regular face for weight(s) {missing}")

    return {w: fetch(faces[w]) for w in weights}


def sized(faces, weight, size):
    """Pillow reads a stream to exhaustion, so each face gets a fresh one."""
    return ImageFont.truetype(io.BytesIO(faces[weight]), size)


def cap_height(font):
    return abs(font.getbbox("H", anchor="ls")[1])


def sized_to_cap(faces, weight, cap):
    """Return the face whose cap height measures `cap` pixels."""
    probe = 200
    return sized(faces, weight, round(cap * probe / cap_height(sized(faces, weight, probe))))


def line_width(font, text, tracking=0):
    return font.getlength(text) + tracking * font.size * max(0, len(text) - 1)


def draw_line(draw, text, font, x, baseline, fill, tracking=0):
    """Draw one line, letter-spaced.

    Pillow has no tracking, so a spaced line is placed glyph by glyph. Each
    glyph is positioned from the measured width of the whole prefix before it
    rather than from the sum of its parts, so the font's kerning survives and
    only the uniform step is added — measuring characters one at a time would
    silently flatten pairs like "Ta" the moment the copy changed."""
    if not tracking:
        draw.text((x, baseline), text, font=font, fill=fill, anchor="ls")
        return

    step = tracking * font.size
    for i, char in enumerate(text):
        draw.text((x + font.getlength(text[:i]) + i * step, baseline),
                  char, font=font, fill=fill, anchor="ls")


def draw_block(draw, lines, font, x, cap_top, leading, fill, tracking=0):
    baseline = cap_top + cap_height(font)
    for line in lines:
        draw_line(draw, line, font, x, round(baseline), fill, tracking)
        baseline += leading


# --------------------------------------------------------------- photos ------
def cover(path, side):
    """object-fit: cover into a square, then the hero's own colour treatment."""
    photo = Image.open(path).convert("RGB")
    scale = side / min(photo.size)
    photo = photo.resize((max(side, round(photo.width * scale)),
                          max(side, round(photo.height * scale))), Image.LANCZOS)
    left = (photo.width - side) // 2
    top = (photo.height - side) // 2
    photo = photo.crop((left, top, left + side, top + side))

    photo = Image.blend(photo, photo.convert("L").convert("RGB"), PHOTO_GRAYSCALE)
    return ImageEnhance.Contrast(photo).enhance(PHOTO_CONTRAST)


def rounded(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1],
                                           radius=radius, fill=255)
    return mask


def cast_shadow(card, pos, size, radius):
    """A blurred, offset copy of the panel's silhouette, as box-shadow draws it."""
    layer = Image.new("L", card.size, 0)
    layer.paste(rounded(size, radius),
                (pos[0] + SHADOW_OFFSET[0], pos[1] + SHADOW_OFFSET[1]))
    layer = layer.filter(ImageFilter.GaussianBlur(SHADOW_BLUR))
    layer = layer.point(lambda v: round(v * SHADOW_ALPHA))
    card.paste(Image.new("RGB", card.size, (0, 0, 0)), (0, 0), layer)


def place_panel(card, photo, pos, ring=0):
    """Drop its shadow, then the page-coloured ring, then the photo itself."""
    size = photo.size
    cast_shadow(card, pos, size, PANEL_RADIUS)

    if ring:
        outer = (size[0] + 2 * ring, size[1] + 2 * ring)
        card.paste(Image.new("RGB", outer, BG),
                   (pos[0] - ring, pos[1] - ring),
                   rounded(outer, PANEL_RADIUS + ring))

    card.paste(photo, pos, rounded(size, PANEL_RADIUS))


# ----------------------------------------------------------------- card ------
def main():
    for path in (MARK, PHOTO_FRONT, PHOTO_BACK):
        if not path.exists():
            sys.exit(f"missing {path.relative_to(ROOT)}"
                     + (" — run tools/make-logo-assets.py first" if path == MARK else ""))

    faces = satoshi()
    wordmark_font = sized_to_cap(faces, 500, WORDMARK_CAP)
    headline_font = sized_to_cap(faces, 500, HEADLINE_CAP)
    summary_font = sized_to_cap(faces, 400, SUMMARY_CAP)
    footline_font = sized_to_cap(faces, 400, FOOTLINE_CAP)

    card = Image.new("RGB", SIZE, BG)
    draw = ImageDraw.Draw(card)

    x = 0
    for width, colour in BAR:
        draw.rectangle([x, 0, x + width - 1, BAR_HEIGHT - 1], fill=colour)
        x += width

    # Mosaic, back panel first so the front one's ring cuts into it.
    panel = round(SHOWCASE_BOX * PANEL_SPAN)
    shift = round(SHOWCASE_BOX * PANEL_OFFSET)
    box_left = SIZE[0] - MARGIN - SHOWCASE_BOX
    place_panel(card, cover(PHOTO_BACK, panel),
                (box_left + shift, SHOWCASE_TOP + shift))
    place_panel(card, cover(PHOTO_FRONT, panel),
                (box_left, SHOWCASE_TOP), ring=PANEL_RING)

    # Brand lockup, the nav's mark-and-word pairing.
    mark = Image.open(MARK).convert("RGBA")
    mark_size = round(mark.width * MARK_HEIGHT / mark.height), MARK_HEIGHT
    mark = mark.convert("RGBa").resize(mark_size, Image.LANCZOS).convert("RGBA")
    card.paste(mark, (MARGIN, SHOWCASE_TOP), mark)

    word_x = MARGIN + mark_size[0] + WORDMARK_GAP
    word_baseline = SHOWCASE_TOP + (MARK_HEIGHT + cap_height(wordmark_font)) // 2
    draw_line(draw, COPY["wordmark"], wordmark_font, word_x, word_baseline,
              INK, WORDMARK_TRACKING)

    draw_block(draw, COPY["headline"], headline_font, MARGIN,
               HEADLINE_CAP_TOP, HEADLINE_LEADING, INK, HEADLINE_TRACKING)
    draw_block(draw, COPY["summary"], summary_font, MARGIN,
               SUMMARY_CAP_TOP, SUMMARY_LEADING, INK_3, SUMMARY_TRACKING)

    # Footline sits on the mosaic's bottom edge, closing both columns together.
    draw_line(draw, COPY["footline"], footline_font, MARGIN, COLUMN_BOTTOM,
              INK_3, FOOTLINE_TRACKING)

    card.save(OUTPUT, quality=QUALITY, optimize=True, progressive=True)

    widest = max(line_width(headline_font, line, HEADLINE_TRACKING)
                 for line in COPY["headline"])
    over = [line for line in COPY["summary"]
            if line_width(summary_font, line, SUMMARY_TRACKING) > COLUMN]
    print(f"og-image.jpg  {SIZE[0]}x{SIZE[1]}  {OUTPUT.stat().st_size / 1024:.1f} KB")
    print(f"headline fits {widest:.0f}/{COLUMN}px"
          + (f"  WARNING: summary overruns the column: {over}" if over else ""))


if __name__ == "__main__":
    main()
