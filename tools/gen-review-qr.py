#!/usr/bin/env python3
"""Generate the Google-review QR code as a static SVG, once.

The QR is built here and committed, never drawn in the browser. A QR library
loaded from a CDN would be a third-party script on every page of the site, and a
deferred script that stalls blocks the site's own JavaScript behind it — which
on a Dhaka mobile connection is exactly when it will happen. Nothing to fetch,
nothing to trust, nothing to fail.

Re-run this only when the review link changes.

    pip install segno && python3 tools/gen-review-qr.py

It reads the link from content/business.json ("reviewUrl") so there is one place
to change it, and writes src/assets/img/review-qr.svg, which build.js copies
into dist/assets/ with everything else.

While "reviewUrl" is empty this exits without writing anything, and build.js
omits the whole review block — no QR, no link, no empty box. Get the real link
from the client's Google Business Profile: Google Business Profile → Read more
about reviews → "Get more reviews" gives a short g.page/r/… link that already
opens the review dialog. Do not guess it.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BUSINESS = ROOT / "content" / "business.json"
OUT = ROOT / "src" / "assets" / "img" / "review-qr.svg"

# Brand colours, so the printed code matches the shop's signage.
DARK = "#0b0b0d"
LIGHT = "#ffffff"


def main() -> int:
    business = json.loads(BUSINESS.read_text(encoding="utf-8"))
    url = (business.get("reviewUrl") or "").strip()

    if not url:
        print('business.json has no "reviewUrl" yet, so there is nothing to encode.')
        print("Ask the client for the Google review link, put it in content/business.json,")
        print("then run this again. The site hides the review block until then.")
        return 0

    try:
        import segno
    except ImportError:
        print("segno is not installed. Run:  pip install segno")
        print("It is only needed to regenerate this file — the website itself has no")
        print("dependencies and never loads a QR library.")
        return 1

    # Error correction M: around 15% of the symbol can be damaged or covered and
    # it still scans. Enough for a card taped to a counter, without inflating the
    # module count and making it harder to read at small print sizes.
    qr = segno.make(url, error="m")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    qr.save(str(OUT), kind="svg", scale=8, dark=DARK, light=LIGHT, border=2)

    print(f"{OUT.relative_to(ROOT)}: version {qr.version}, "
          f"{len(qr.matrix)}x{len(qr.matrix)} modules")
    print(f"encodes: {url}")
    print("Now run `node build.js` — the review block appears on the About page")
    print("and in the footer, in both languages.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
