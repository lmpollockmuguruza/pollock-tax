"""Stamp styles.css and site.js with a content hash in every page that links them.

The site has no build step, so browsers and CDNs are free to keep serving an
old styles.css or site.js against a freshly deployed index.html. When that
happens the page half-works: new markup, old rules. Appending a hash of the
file's contents to the URL makes each version a distinct URL, so a changed
file is always fetched and an unchanged one stays cached.

Run this after editing styles.css or site.js, before committing:

    python3 tools/stamp-assets.py
"""

import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ["styles.css", "site.js"]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


def main():
    stamps = {}
    for name in ASSETS:
        path = ROOT / name
        if not path.exists():
            sys.exit(f"missing {name}")
        stamps[name] = digest(path)

    changed = []
    for page in sorted(ROOT.glob("*.html")):
        text = page.read_text(encoding="utf-8")
        original = text
        for name, stamp in stamps.items():
            # match the asset with or without an existing ?v= stamp
            text = re.sub(
                rf'(href|src)="{re.escape(name)}(?:\?v=[0-9a-f]+)?"',
                rf'\1="{name}?v={stamp}"',
                text,
            )
        if text != original:
            page.write_text(text, encoding="utf-8")
            changed.append(page.name)

    for name, stamp in stamps.items():
        print(f"{name} -> ?v={stamp}")
    print("updated:", ", ".join(changed) if changed else "nothing (already current)")


if __name__ == "__main__":
    main()
