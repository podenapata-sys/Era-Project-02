#!/usr/bin/env python3
"""Turn the client's raw phone photos into the site's images, in one command.

Twenty-one photographs cover the whole site, because several of them are shown
in more than one place and each place wants a different shape. A category photo
appears as a wide card on the home page and as a tall block on the products
page; a trade photo appears in the services grid and again across the top of its
own page. Cropping those by hand, twice each, is where an afternoon goes.

    pip install pillow && python3 tools/add-photos.py

Reads the photos from photos-inbox/, writes src/assets/img/photos/, and
build.js copies that into dist/ with the rest of the assets. Nothing here runs
on the website — like tools/gen-review-qr.py, this is a one-off you run when new
photographs arrive, and the site itself still has no dependencies.

    python3 tools/add-photos.py --status    what is here, what is missing
    python3 tools/add-photos.py --init      write content/photos.json
    python3 tools/add-photos.py             process everything in the inbox

--status prints the filenames it is waiting for. That list is what you send the
client when chasing the rest; it names them exactly rather than describing them.

Photographs are dropped in named after the slot they fill — shopfront.jpg,
cat-ceramic.jpg, trade-core-cutting.jpg — and the extension does not matter.
Partial deliveries are fine: whatever is present is processed, and every slot
still missing keeps its placeholder until its photo turns up.

WHAT IT DOES TO EACH PHOTO, AND WHY

  1. Applies the EXIF rotation flag. A phone records "this was shot in
     portrait" as a tag rather than rotating the pixels, so a photo that looks
     upright in the gallery loads sideways in a browser. This is the single
     thing most likely to be got wrong by hand, and it has to happen before the
     crop or the crop takes the wrong edges.
  2. Crops to each shape it is needed at, biased slightly above centre so a
     shop sign or a face survives the crop instead of losing its top.
  3. Strips EXIF on the way out. Phone photos carry GPS coordinates. The shop's
     address is public and on every page; where the owner's phone has been is
     not, and it should not be published as a side effect of sending a photo.
  4. Writes WebP at two or three widths for the browser to choose from, and one
     JPEG as a fallback. Customers here are on cheap Android phones on mobile
     data, so both the smaller files and the fallback earn their place.
"""
import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
COPY = ROOT / "content" / "copy.json"
MANIFEST = ROOT / "content" / "photos.json"
INBOX = ROOT / "photos-inbox"
OUT = ROOT / "src" / "assets" / "img" / "photos"

SOURCE_EXT = (".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif")

# Each shape the site renders a photo at: the aspect ratio, and the widths
# written for it. The widths are what the browser picks between — roughly the
# displayed size, and double it for a high-density screen, which every phone
# sold in the last decade has.
RENDITIONS = {
    "hero":  ((4, 3),   (720, 1440)),
    "wide":  ((5, 4),   (640, 1280)),
    "card":  ((16, 9),  (400, 800)),
    "sq43":  ((4, 3),   (400, 800, 1120)),
    "trade": ((16, 10), (720, 1440)),
}

# Which shapes each kind of photo has to be cut to. These mirror the call sites
# in build.js: a category is a card on two pages and a block on a third, a trade
# is a card in the services grid and a wide strip on its own page.
SHOP_RENDITIONS = ("hero", "wide")
CATEGORY_RENDITIONS = ("card", "sq43")
TRADE_RENDITIONS = ("sq43", "trade")

# The three that are not a category or a trade, and what to shoot for each.
SHOP_KEYS = {
    "shopfront": "The shop from the street, with the sign readable",
    "counter": "The counter, or an order going out the door",
    "stock": "A wall of pipe and fittings — the range, in one frame",
}

# Above centre. A shop front photographed from across the street puts the sign
# in the top third, and a true centre crop is what cuts the name off.
DEFAULT_FOCUS = (0.5, 0.42)

WEBP_QUALITY = 82
JPEG_QUALITY = 82


def slugs():
    """The categories and trades, read from the content rather than repeated
    here, so renaming one in copy.json cannot silently orphan its photograph."""
    copy = json.loads(COPY.read_text(encoding="utf-8"))
    en = copy["en"]
    return ([(c["slug"], c["title"]) for c in en["categories"]],
            [(s["slug"], s["title"]) for s in en["services"]])


def expected():
    """Every photo the site can use, in the order it is worth shooting them:
    the shop itself, then what it sells, then what it does. The description is
    what gets sent to the client, so it names the thing rather than its slug."""
    cats, trades = slugs()
    plan = [(k, SHOP_RENDITIONS, SHOP_KEYS[k]) for k in SHOP_KEYS]
    plan += [("cat-" + s, CATEGORY_RENDITIONS, t) for s, t in cats]
    plan += [("trade-" + s, TRADE_RENDITIONS, t) for s, t in trades]
    return plan


def find_source(key):
    """The inbox file for this key, whatever extension it arrived with."""
    if not INBOX.is_dir():
        return None
    for ext in SOURCE_EXT:
        for candidate in (INBOX / (key + ext), INBOX / (key + ext.upper())):
            if candidate.is_file():
                return candidate
    return None


def load_manifest():
    if not MANIFEST.is_file():
        return {}
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    return {k: v for k, v in data.items() if not k.startswith("_")}


def focus_for(entry):
    focus = (entry or {}).get("focus")
    if (isinstance(focus, list) and len(focus) == 2
            and all(isinstance(n, (int, float)) and 0 <= n <= 1 for n in focus)):
        return (float(focus[0]), float(focus[1]))
    return DEFAULT_FOCUS


def status():
    plan = expected()
    here = [(k, r, d) for k, r, d in plan if find_source(k)]
    missing = [(k, r, d) for k, r, d in plan if not find_source(k)]

    print(f"{len(here)} of {len(plan)} photographs are in {INBOX.name}/\n")
    if here:
        print("Have:")
        for key, _, _ in here:
            print(f"  {find_source(key).name}")
        print()
    if missing:
        print("Still needed — name the file exactly this, any extension:")
        width = max(len(k) for k, _, _ in missing) + len(".jpg") + 2
        for key, _, description in missing:
            print(f"  {(key + '.jpg').ljust(width)}{description}")
        print()
        print("Send the client that list. Naming them on the phone before")
        print("sending is quicker than renaming twenty of them afterwards.")
    else:
        print("Nothing outstanding. Run without --status to process them.")
    return 0


def init():
    if MANIFEST.is_file():
        print(f"{MANIFEST.relative_to(ROOT)} already exists — leaving it alone.")
        print("Delete it first if you want a fresh one.")
        return 1

    skeleton = {
        "_readme": [
            "Alt text for the photographs, and optionally where to crop them.",
            "Only the three shop photos need an entry: a category or trade photo",
            "describes itself with its own title from copy.json, in whichever",
            "language the page is in. Add a key here to say something better.",
            "",
            "  \"cat-ceramic\": {",
            "    \"alt\": { \"en\": \"...\", \"bn\": \"...\" },",
            "    \"focus\": [0.5, 0.3]",
            "  }",
            "",
            "focus is where the centre of the crop sits, as a fraction of the",
            "width and height. The default is [0.5, 0.42], slightly above centre.",
            "Lower the second number to keep more of the top of the frame.",
        ],
        "shopfront": {
            "alt": {
                "en": "The ERA Sanitary shop on D.I.T Road, Rampura",
                "bn": "রামপুরা ডি.আই.টি রোডে ইরা স্যানিটারির দোকান",
            }
        },
        "counter": {
            "alt": {
                "en": "The counter at ERA Sanitary, Rampura",
                "bn": "ইরা স্যানিটারির কাউন্টার, রামপুরা",
            }
        },
        "stock": {
            "alt": {
                "en": "Pipes and fittings in stock at ERA Sanitary",
                "bn": "ইরা স্যানিটারিতে মজুত পাইপ ও ফিটিংস",
            }
        },
    }
    MANIFEST.write_text(json.dumps(skeleton, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")
    print(f"Wrote {MANIFEST.relative_to(ROOT)}.")
    print("Edit the alt text if the photographs show something more specific.")
    return 0


def process():
    try:
        from PIL import Image, ImageOps
    except ImportError:
        print("Pillow is not installed. Run:  pip install pillow")
        print("It is only needed here — the website itself has no dependencies.")
        return 1

    if not INBOX.is_dir():
        print(f"There is no {INBOX.name}/ directory yet.")
        print("Make it, put the photographs in, then run this again:")
        print(f"  mkdir {INBOX.name}")
        print(f"  python3 tools/add-photos.py --status")
        return 1

    manifest = load_manifest()
    plan = expected()
    known = {key for key, _, _ in plan}

    # A file in the inbox that matches no slot is a typo in the name, and a
    # typo means a photo silently not appearing on the site. Say so.
    strays = sorted(
        p.name for p in INBOX.iterdir()
        if p.is_file() and p.suffix.lower() in SOURCE_EXT and p.stem not in known
    )

    OUT.mkdir(parents=True, exist_ok=True)
    written = 0
    done = []

    for key, rendition_names, _ in plan:
        source = find_source(key)
        if not source:
            continue

        with Image.open(source) as raw:
            # Before anything else: honour the rotation flag, or every photo
            # shot in portrait is cropped along the wrong edges and published
            # on its side.
            upright = ImageOps.exif_transpose(raw)
            # Greyscale, palette and anything with transparency all become RGB;
            # JPEG cannot store an alpha channel and would fail on the way out.
            if upright.mode != "RGB":
                upright = upright.convert("RGB")

            centering = focus_for(manifest.get(key))

            for name in rendition_names:
                (rw, rh), widths = RENDITIONS[name]
                for i, width in enumerate(widths):
                    height = round(width * rh / rw)
                    cut = ImageOps.fit(upright, (width, height),
                                       method=Image.LANCZOS, centering=centering)
                    stem = OUT / f"{key}-{name}-{width}"
                    # Saving without passing exif= is what drops it, GPS included.
                    cut.save(stem.with_suffix(".webp"), "WEBP",
                             quality=WEBP_QUALITY, method=6)
                    written += 1
                    if i == 0:
                        cut.save(stem.with_suffix(".jpg"), "JPEG",
                                 quality=JPEG_QUALITY, optimize=True,
                                 progressive=True)
                        written += 1

        done.append(key)
        print(f"  {source.name} -> {', '.join(rendition_names)}")

    print()
    if done:
        print(f"{len(done)} photographs, {written} files, in "
              f"{OUT.relative_to(ROOT)}")
    else:
        print(f"Nothing to do — {INBOX.name}/ has none of the expected names.")

    if strays:
        print()
        print("Ignored, because the name matches no slot on the site:")
        for name in strays:
            print(f"  {name}")
        print("Run --status for the names these should have.")

    remaining = len(plan) - len(done)
    print()
    if remaining:
        print(f"{remaining} still to come — run --status for the list.")
    print("Now run `node build.js`. Every photo present is on the site; every")
    print("one still missing keeps its placeholder.")
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Crop and compress the client's photographs for the site.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--status", action="store_true",
                       help="list what has arrived and what is still missing")
    group.add_argument("--init", action="store_true",
                       help="write content/photos.json")
    args = parser.parse_args()

    if args.status:
        return status()
    if args.init:
        return init()
    return process()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BrokenPipeError:
        # `--status | head` closes the pipe early. That is a normal way to read a
        # twenty-one line list, not an error worth a stack trace.
        try:
            sys.stdout.close()
        finally:
            sys.exit(0)
