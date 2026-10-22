#!/usr/bin/env python3
"""Turn the client's raw phone photos into the site's images, in one command.

Twenty-two photographs cover the whole site, because several of them are shown
in more than one place and each place wants a different shape. A category photo
appears as a wide card on the home page and as a tall block on the products
page; a trade photo appears in the services grid and again across the top of its
own page. Cropping those by hand, twice each, is where an afternoon goes.

Twenty-one of them are of things. The twenty-second, owner.jpg, is of a person,
and is the only photograph here that cannot be re-shot or stood in for.

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
import re
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
COPY = ROOT / "content" / "copy.json"
MANIFEST = ROOT / "content" / "photos.json"
INBOX = ROOT / "photos-inbox"
OUT = ROOT / "src" / "assets" / "img" / "photos"

SOURCE_EXT = (".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif")

# Widths above this are written when the source can fill them and quietly left
# out when it cannot. Only "item" has one.
#
# The number is 848 rather than the ladder's top of 960 because the two are
# indistinguishable where it counts. The lightbox is min(92vw, 560px), so 560
# CSS pixels is the widest it ever draws; 960 is 1.71x that and 848 is 1.51x,
# and neither is the 2x a retina screen would ideally get. Rendered at that
# size and compared side by side they cannot be told apart. What 848 is NOT is
# a licence to go lower: 480 would be under 1x on the same display and visibly
# soft, so a source that cannot reach 848 is refused like any other.
#
# Nothing else gets this. A category or trade photograph IS the page it sits
# on, so one too small to fill its crop is not worth publishing small; it is
# refused, which is what caught a batch of product shots saved off another
# company's website.
OPTIONAL_ABOVE = {"item": 848}

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
    # The owner's portrait, drawn as a 120px circle: 1x and 2x of that, square.
    "face":  ((1, 1),   (240, 480)),
    # One catalogue item, in the grid on the products page. The 960 is not for
    # the grid — it is what the lightbox opens when the card is tapped.
    "item":  ((1, 1),   (240, 480, 848, 960)),
}

# Which shapes each kind of photo has to be cut to. These mirror the call sites
# in build.js: a category is a card on two pages and a block on a third, a trade
# is a card in the services grid and a wide strip on its own page.
SHOP_RENDITIONS = ("hero", "wide")
CATEGORY_RENDITIONS = ("card", "sq43")

# The home page's hero is the stock photograph — a wall of pipe and fittings,
# the picture that answers "will they have my size". Until that photograph
# exists, the page would open on a dashed placeholder filling half the first
# screen on a desktop, which is the worst thing a visitor can see first.
#
# So one category image stands in, and it is honest about what it is: a picture
# of products the shop sells, captioned as products, claiming nothing about the
# premises. It needs the bigger 4:3 shape as well as its own two.
#
# build.js names the same key. When the real stock photograph arrives, change it
# back there and this line can go.
HOME_HERO = "cat-bathroom-fittings"
TRADE_RENDITIONS = ("sq43", "trade")
ITEM_RENDITIONS = ("item",)

# Items in copy.json are plain strings, so their photo key is derived from the
# ENGLISH name: item-<category>-<item>.
#
# build.js derives exactly the same name in itemSlug(), and the two MUST agree.
# If they ever stop agreeing, this script writes files under names the site
# never asks for, and the client sees every placeholder still empty after
# sending eighty-two photographs. build.js fails the build on an item-* file it
# cannot place, which is what catches it — but keep these two in step by hand.
ETC = {"etc.", "ইত্যাদি"}


def item_slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("&", " ")).strip("-")

# The owner, on his own, because he is cut to a shape nothing else uses. Kept
# out of SHOP_KEYS deliberately: those are all shot wide and get hero + wide,
# and a 4:3 hero crop of a headshot is a chin.
OWNER_KEY = "owner"
OWNER_RENDITIONS = ("face",)
OWNER_DESC = "The owner, head and shoulders, plain background"

# The three that are not a category or a trade, and what to shoot for each.
SHOP_KEYS = {
    "shopfront": "The shop from the street, with the sign readable",
    "counter": "The counter, or an order going out the door",
    "stock": "A wall of pipe and fittings — the range, in one frame",
}

# Above centre. A shop front photographed from across the street puts the sign
# in the top third, and a true centre crop is what cuts the name off.
DEFAULT_FOCUS = (0.5, 0.42)

# 74, not the usual 82. Measured on trade-plumbing at 800px: 72.4 KB at 82
# against 50.0 KB at 74, a 31% saving, and the two are indistinguishable at 1:1
# on the most detail-heavy region in the set — wrench teeth, pipe highlight,
# render texture. On the page they are downscaled further still: an 800px file
# draws into a 348px card. The saving is not academic. The services listing
# carries eleven trade photographs and was 1.2 MB fully scrolled, which is a
# real cost on the Dhaka mobile data this site is built for.
#
# The JPEG stays at 82. It is the fallback for browsers with no WebP, which is
# almost nobody, so it barely moves the real-world total — and JPEG shows its
# artefacts earlier than WebP does at the same number.
WEBP_QUALITY = 74
JPEG_QUALITY = 82


def slugs():
    """The categories and trades, read from the content rather than repeated
    here, so renaming one in copy.json cannot silently orphan its photograph."""
    copy = json.loads(COPY.read_text(encoding="utf-8"))
    en = copy["en"]
    return ([(c["slug"], c["title"]) for c in en["categories"]],
            [(s["slug"], s["title"]) for s in en["services"]],
            [(c["slug"], c["title"], it)
             for c in en["categories"] for it in c["items"] if it not in ETC])


def expected():
    """Every photo the site can use, in the order it is worth shooting them:
    the shop itself, then the man who runs it, then what it sells, then what it
    does. The description is what gets sent to the client, so it names the thing
    rather than its slug."""
    cats, trades, items = slugs()
    plan = [(k, SHOP_RENDITIONS, SHOP_KEYS[k]) for k in SHOP_KEYS]
    plan += [(OWNER_KEY, OWNER_RENDITIONS, OWNER_DESC)]
    plan += [("cat-" + s,
              CATEGORY_RENDITIONS + (("hero",) if "cat-" + s == HOME_HERO else ()),
              t) for s, t in cats]
    plan += [("trade-" + s, TRADE_RENDITIONS, t) for s, t in trades]
    plan += [(f"item-{cs}-{item_slug(it)}", ITEM_RENDITIONS, f"{it} ({ct})")
             for cs, ct, it in items]
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


def crop_size(src, ratio):
    """The pixels ImageOps.fit actually keeps when it cuts src to ratio."""
    (sw, sh), (rw, rh) = src, ratio
    if sw * rh > sh * rw:            # source wider than the shape wanted
        return (round(sh * rw / rh), sh)
    return (sw, round(sw * rh / rw))


def too_small(src, rendition_names):
    """Every rendition this source cannot fill without being enlarged.

    ImageOps.fit will scale 600px up to 1120px without complaint, and the
    result is a photograph that looks fine as a thumbnail and soft on the page.
    Nothing warned about that before, which is how a batch of product shots
    saved off someone else's website — not one of them over 1080px wide — got
    as far as being processed.

    The test is done on the crop, not the file. A 1792x1024 frame passes for a
    category; the same pixel count as 1024x1792 does not, because the 4:3 cut
    throws the height away. Measuring the file alone would pass the second one.

    It also settles the shop photographs mechanically rather than by assertion:
    1792x1024 is the best any generator offers and its 4:3 crop is 1365px wide,
    under the 1440 the hero rendition needs, so shopfront, counter and stock
    cannot come from one. They have to be photographed.
    """
    short = []
    for name in rendition_names:
        ratio, widths = RENDITIONS[name]
        want_w = OPTIONAL_ABOVE.get(name, max(widths))
        want_h = round(want_w * ratio[1] / ratio[0])
        have_w, have_h = crop_size(src, ratio)
        if have_w < want_w or have_h < want_h:
            short.append((name, want_w, want_h, have_w, have_h))
    return short


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
    skipped = []

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

            # After exif_transpose, never before: a portrait photo reports
            # its size the wrong way round until the flag has been applied,
            # and would be measured against the wrong edge.
            short = too_small(upright.size, rendition_names)
            if short:
                skipped.append((source.name, upright.size, short))
                continue

            centering = focus_for(manifest.get(key))

            for name in rendition_names:
                (rw, rh), widths = RENDITIONS[name]
                have_w, have_h = crop_size(upright.size, (rw, rh))
                first = True
                for width in widths:
                    height = round(width * rh / rw)
                    # Never enlarge. too_small() has already refused anything
                    # that cannot fill this rendition's required width, so what
                    # is dropped here is only ever an optional top width.
                    if have_w < width or have_h < height:
                        continue
                    cut = ImageOps.fit(upright, (width, height),
                                       method=Image.LANCZOS, centering=centering)
                    stem = OUT / f"{key}-{name}-{width}"
                    # Saving without passing exif= is what drops it, GPS included.
                    cut.save(stem.with_suffix(".webp"), "WEBP",
                             quality=WEBP_QUALITY, method=6)
                    written += 1
                    if first:
                        cut.save(stem.with_suffix(".jpg"), "JPEG",
                                 quality=JPEG_QUALITY, optimize=True,
                                 progressive=True)
                        written += 1
                        first = False

        done.append(key)
        print(f"  {source.name} -> {', '.join(rendition_names)}")

    print()
    if done:
        print(f"{len(done)} photographs, {written} files, in "
              f"{OUT.relative_to(ROOT)}")
    else:
        print(f"Nothing to do — {INBOX.name}/ has none of the expected names.")

    if skipped:
        print()
        print("Skipped, because enlarging these would publish a blurred photo:")
        for name, (sw, sh), short in skipped:
            print(f"  {name} is {sw}x{sh}")
            for rendition, want_w, want_h, have_w, have_h in short:
                print(f"    {rendition} needs {want_w}x{want_h}, "
                      f"this gives {have_w}x{have_h}")
        print("Supply a bigger original. Ask the generator for landscape, and")
        print("do not enlarge it yourself first — that blurs it just the same.")

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
        # twenty-two line list, not an error worth a stack trace.
        try:
            sys.stdout.close()
        finally:
            sys.exit(0)
