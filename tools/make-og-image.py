"""Draw images/og-image.jpg — the card social platforms show when a page is shared.

The card has to ship as a raster, because no platform renders SVG for
og:image. But baking type into a JPEG means the words and the typeface can
drift from the site with nothing to catch it, and both had: the card this
replaces read "U.S. taxes, handled properly, in Spain." — selling one side of
a practice whose whole premise is both — and it was set in DejaVu Sans,
because whatever drew it ran somewhere Satoshi was not installed and the
fallback was silent.

So the copy lives in COPY below, next to the site's own wording, and the
script fetches Satoshi from the same host the pages load it from and refuses
to draw anything if that fetch fails. Layout is in fixed pixels because this
image is a fixed 1200x630; the numbers reproduce the card's original
composition, with the type specified by cap height so it sits at the same
optical scale in a face whose cap-to-em ratio differs.

Run after editing the copy, or after the mark changes:

    python3 tools/make-logo-assets.py      # first: refreshes the mark
    python3 tools/make-og-image.py

Needs Pillow and network access. Neither is needed to serve the site.
"""

import io
import pathlib
import re
import sys
import urllib.request

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("needs Pillow:  python3 -m pip install pillow")

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMAGES = ROOT / "images"
OUTPUT = IMAGES / "og-image.jpg"
MARK = IMAGES / "logo-mark-512.png"

# ---------------------------------------------------------------- copy -------
# Keep the headline to two lines and the summary to three: the layout has room
# for no more before the summary crowds the footline. Line breaks are manual so
# they fall where they read best rather than wherever the measure runs out.
COPY = {
    "headline": [
        "U.S. and Spanish taxes,",
        "handled with care.",
    ],
    "summary": [
        "One advisor for both sides — federal",
        "returns, FBAR, FATCA, Modelo 100 and",
        "Modelo 720.",
    ],
    "name": "Pollock Tax & Consulting",
    "where": "pollocktax.com · Madrid",
}

# --------------------------------------------------------------- design ------
SIZE = (1200, 630)          # 1.91:1, what Facebook, LinkedIn and X all expect
MARGIN_X = 80

# Tokens copied from :root in styles.css.
BG = (250, 250, 247)
INK = (10, 18, 38)
INK_3 = (90, 100, 120)
INK_4 = (138, 147, 166)
ACCENT = (10, 49, 97)       # Old Glory Blue
US_RED = (179, 25, 66)      # Old Glory Red
ES_RED = (170, 21, 27)      # Spanish flag red
ES_GOLD = (241, 191, 0)     # Spanish flag yellow

# Flag bar. The left 600px carries the U.S. colours and the right 600px
# Spain's, so the two-system premise reads before a word does.
BAR_HEIGHT = 6
BAR = [(395, ACCENT), (205, US_RED), (335, ES_RED), (265, ES_GOLD)]

MARK_TOP = 73
MARK_HEIGHT = 100

# Each block is sized by cap height and anchored by the cap top of its first
# line. Both are what the eye actually reads as the type's size and top edge,
# and neither is a fixed fraction of the em — cap-to-em differs enough between
# faces that a pixel size carried over from the old card's DejaVu lands about
# 12% too large in Satoshi. Solving for the cap instead reproduces the original
# composition whatever face is loaded.
HEADLINE_CAP_TOP = 226
HEADLINE_CAP = 47
HEADLINE_LEADING = 69
HEADLINE_TRACKING = -0.024      # em, matching .display-1 on the site

SUMMARY_CAP_TOP = 388
SUMMARY_CAP = 19
SUMMARY_LEADING = 36.5
SUMMARY_TRACKING = -0.006

FOOT_CAP_TOP = 536
FOOT_CAP = 16
NAME_TRACKING = 0.055           # the site sets its small caps wide
WHERE_TRACKING = 0

QUALITY = 90

FONT_CSS = "https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap"


def satoshi(weights=(400, 500, 700)):
    """Fetch Satoshi from the host the site loads it from, keyed by weight.

    Pillow cannot read woff2, so this picks the .ttf alternative out of the
    same stylesheet the pages link. A miss is fatal rather than warned about:
    a card that quietly falls back to a system face is the bug this replaces.
    """
    try:
        css = urllib.request.urlopen(FONT_CSS, timeout=30).read().decode()
    except OSError as err:
        sys.exit(f"could not fetch Satoshi ({err}).\n"
                 "Refusing to draw a card in a fallback face — check network access.")

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

    return {w: urllib.request.urlopen(faces[w], timeout=30).read() for w in weights}


def sized(faces, weight, size):
    """Pillow reads a stream to exhaustion, so each face gets a fresh one."""
    return ImageFont.truetype(io.BytesIO(faces[weight]), size)


def cap_height(font):
    return abs(font.getbbox("H", anchor="ls")[1])


def sized_to_cap(faces, weight, cap):
    """Return the face whose cap height measures `cap` pixels."""
    probe = 200
    ratio = cap_height(sized(faces, weight, probe)) / probe
    return sized(faces, weight, round(cap / ratio))


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


def main():
    if not MARK.exists():
        sys.exit(f"missing {MARK.relative_to(ROOT)} — run tools/make-logo-assets.py first")

    faces = satoshi()
    headline_font = sized_to_cap(faces, 500, HEADLINE_CAP)
    summary_font = sized_to_cap(faces, 400, SUMMARY_CAP)
    name_font = sized_to_cap(faces, 700, FOOT_CAP)
    where_font = sized_to_cap(faces, 400, FOOT_CAP)

    card = Image.new("RGB", SIZE, BG)
    draw = ImageDraw.Draw(card)

    x = 0
    for width, colour in BAR:
        draw.rectangle([x, 0, x + width - 1, BAR_HEIGHT - 1], fill=colour)
        x += width

    mark = Image.open(MARK).convert("RGBA")
    scaled = round(mark.width * MARK_HEIGHT / mark.height), MARK_HEIGHT
    mark = mark.convert("RGBa").resize(scaled, Image.LANCZOS).convert("RGBA")
    card.paste(mark, (MARGIN_X, MARK_TOP), mark)

    baseline = HEADLINE_CAP_TOP + cap_height(headline_font)
    for line in COPY["headline"]:
        draw_line(draw, line, headline_font, MARGIN_X, round(baseline), INK, HEADLINE_TRACKING)
        baseline += HEADLINE_LEADING

    baseline = SUMMARY_CAP_TOP + cap_height(summary_font)
    for line in COPY["summary"]:
        draw_line(draw, line, summary_font, MARGIN_X, round(baseline), INK_3, SUMMARY_TRACKING)
        baseline += SUMMARY_LEADING

    baseline = round(FOOT_CAP_TOP + cap_height(name_font))
    draw_line(draw, COPY["name"].upper(), name_font, MARGIN_X, baseline, ACCENT, NAME_TRACKING)

    where_width = where_font.getlength(COPY["where"])
    draw_line(draw, COPY["where"], where_font, SIZE[0] - MARGIN_X - where_width,
              baseline, INK_4, WHERE_TRACKING)

    card.save(OUTPUT, quality=QUALITY, optimize=True, progressive=True)
    print(f"og-image.jpg  {SIZE[0]}x{SIZE[1]}  {OUTPUT.stat().st_size / 1024:.1f} KB")
    print(f'headline: {" / ".join(COPY["headline"])}')


if __name__ == "__main__":
    main()
