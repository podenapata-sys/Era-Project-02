#!/usr/bin/env python3
"""Assemble the item prompts from PHOTO-PROMPTS.md into ready-to-paste text.

    python3 tools/build-prompts.py            every category
    python3 tools/build-prompts.py cpvc       just one
    python3 tools/build-prompts.py --poster   the Facebook/WhatsApp framing

Section 4 of PHOTO-PROMPTS.md stores a prompt in three parts — FRAME, SUBJECT,
FINISH — so that the framing and the lighting are written once rather than
eighty-one times. That is right for the file and wrong for the person at the
keyboard, who has to paste three pieces together for every single image and
whose mistake is silent: drop the FINISH and the picture still generates, just
on the wrong background; drop the FRAME and the square crop eats it.

So the joining happens here instead. The file stays the one place the wording
lives, and what comes out is a block per item that can be copied in one go, with
the exact filename to save it as above it.

The slug comes from tools/add-photos.py by import, not by a third copy of the
rule. build.js has the second copy and cannot import Python; a third would be
one more thing to keep in step.

Writes prompts/<category>.txt. Generated, so it is not committed — regenerate it
whenever the wording or the item list changes.
"""
import importlib.util
import io
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "PHOTO-PROMPTS.md"
COPY = ROOT / "content" / "copy.json"
OUT = ROOT / "prompts"

_spec = importlib.util.spec_from_file_location("add_photos", ROOT / "tools" / "add-photos.py")
_ap = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_ap)
item_slug, ETC = _ap.item_slug, _ap.ETC


def quoted(md, label):
    """The blockquote line that follows a **LABEL** heading."""
    at = md.index("**%s**" % label)
    for line in md[at:].splitlines()[1:]:
        if line.startswith("> "):
            return line[2:].strip()
    sys.exit("PHOTO-PROMPTS.md has no quoted line under **%s**" % label)


def tables(md):
    """{category title: [(item, subject), ...]} from section 4."""
    sec = md[md.index("# 4. Item images"):]
    out, title = {}, None
    for line in sec.splitlines():
        head = re.match(r"^## (.+?)(?: — \d+)?$", line)
        if head:
            title = head.group(1).strip()
            continue
        row = re.match(r"^\| \*\*(.+?)\*\* \| (.+?) \|$", line)
        if row and title:
            out.setdefault(title, []).append((row.group(1), row.group(2).strip()))
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    poster = "--poster" in sys.argv[1:]

    md = SOURCE.read_text(encoding="utf-8")
    frame = quoted(md, "FRAME-POSTER" if poster else "FRAME-SITE")
    finish = quoted(md, "FINISH")
    found = tables(md)
    cats = json.loads(COPY.read_text(encoding="utf-8"))["en"]["categories"]

    wanted = [c for c in cats if not args or c["slug"] in args]
    if not wanted:
        sys.exit("no such category: %s\nHave: %s"
                 % (", ".join(args), ", ".join(c["slug"] for c in cats)))

    OUT.mkdir(exist_ok=True)
    for cat in wanted:
        rows = found.get(cat["title"])
        if rows is None:
            sys.exit('PHOTO-PROMPTS.md section 4 has no table headed "%s"' % cat["title"])

        # The two files must agree, but not symmetrically, because the two ways
        # of disagreeing are not the same thing.
        #
        # A prompt for an item copy.json does not have is a bug: the picture has
        # no slot and nothing will ever show it. That stops the build.
        #
        # An item with no prompt is a decision — "Kitchen accessories" is a
        # catch-all and deliberately has none, because whatever a generator drew
        # for it would become a claim about specific stock. That is allowed, but
        # it is printed, so an item dropped by accident does not pass as one
        # dropped on purpose.
        expect = [i for i in cat["items"] if i not in ETC]
        names = [n for n, _ in rows]
        orphan = [n for n in names if n not in expect]
        if orphan:
            sys.exit("%s: PHOTO-PROMPTS.md has a prompt for %s, which copy.json "
                     "does not list.\nNothing on the site would ever show it."
                     % (cat["slug"], ", ".join(orphan)))
        if names != [n for n in expect if n in names]:
            sys.exit("%s: the prompts are not in copy.json's order, so the "
                     "numbering would mislead." % cat["slug"])
        skipped = [i for i in expect if i not in names]

        # The resolution goes at the top, not only inside each prompt. It is
        # set once in Gemini before the first paste and no wording in the
        # prompt can reach it: a batch generated at 1K comes back at 1264x848,
        # which the square crop takes to 848 against the 960 an item needs, and
        # every image in it is refused.
        lines = ["%s — %d images" % (cat["title"], len(rows)),
                 "Set Gemini to 2K and 3:2 landscape before you start. At 1K "
                 "every image comes back too small.",
                 "Save each file under the name above it, with .jpg once.",
                 "Generated from PHOTO-PROMPTS.md. Do not edit this file; edit that one.",
                 ""]
        for n, (item, subject) in enumerate(rows, 1):
            key = "item-%s-%s" % (cat["slug"], item_slug(item))
            lines += ["=" * 72,
                      "%d / %d   save as:  %s.jpg" % (n, len(rows), key),
                      "=" * 72,
                      "",
                      frame.replace("SUBJECT", subject) + " " + finish,
                      ""]
        path = OUT / ("%s%s.txt" % (cat["slug"], "-poster" if poster else ""))
        io.open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
        note = "   (no prompt: %s)" % ", ".join(skipped) if skipped else ""
        print("%-28s %2d prompts%s" % (path.relative_to(ROOT), len(rows), note))
    return 0


if __name__ == "__main__":
    sys.exit(main())
