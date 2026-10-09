#!/usr/bin/env python3
"""Fetch the site's web fonts from Google's CDN into src/assets/fonts/.

RULES.md rule 5 bans third-party scripts on customer-facing pages. A stylesheet
is within the letter of that rule, which is why the Google Fonts link survived
as long as it did — but it is still a render-blocking request to a host we do
not control, on a connection where that is exactly when it hurts. Self-hosting
removes the last one: the site now makes zero third-party requests.

This does NOT save bytes. It is the same files Google serves; what it saves is
two DNS+TLS handshakes and one cross-origin round trip before any text paints.
Cross-site cache partitioning (Chrome 86+, Safari, Firefox) means there is no
longer a shared-cache benefit to give up by self-hosting.

The files are committed, unlike tools/.fonts/ — those are TTFs for the PDF
generator, replaced by a one-second download, so .gitignore drops them. These
ship to every visitor, so they have to be in the repository, and that means
carrying OFL.txt beside them.

Run it when a weight is added to styles.css or a face needs re-fetching:

    python3 tools/fetch-web-fonts.py

It prints the @font-face block to paste into styles.css, with the real
unicode-range values from Google rather than hand-copied ones.
"""

import os
import re
import subprocess
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'assets', 'fonts')

# Google serves woff2 only to a browser that advertises it. With curl's default
# agent it returns ttf, which is roughly twice the size for the same glyphs.
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0 Safari/537.36')

# Which faces the site actually uses, and nothing more.
#
# Archivo is a VARIABLE font: Google returns one file covering the whole wght
# axis no matter which weights are asked for (verified — the URL is identical
# for 600, 700, 800 and for 100..900). So it ships as a single face declared
# `font-weight: 100 900`. styles.css uses display at 600/700/800, but two rules
# (`h1, h2, h3` and `.revs__score`) set the family without a weight and inherit
# 400, so the wide declaration avoids a silent clamp.
#
# Noto Sans Bengali is variable too, and that is most of why it replaced Hind
# Siliguri: one 105 KB file covering wght 100..900 against three static weights
# costing 213.7 KB together. It also has a `wdth` axis, which is NOT asked for —
# requesting `wdth,wght` returns 185.6 KB instead of 105.2 KB for a width this
# site never uses.
#
# Barlow is static — Google rejects a `wght@100..900` request for it — so each
# weight is its own file.
#
# Barlow is fetched at 400 and 700 ONLY. Every other weight in styles.css —
# the eleven 600s and the one 500 — sits under a rule that sets --font-display,
# so it resolves to Archivo's variable file, never to Barlow. Verified two ways:
# statically, by resolving the family for each of those rules, and empirically,
# by crawling all 32 public pages to the bottom and recording which files the
# browser actually requested. Barlow 500 and 600 were requested by none.
#
# The weight rule survives the variable font and is the one to remember: adding
# a weight to styles.css is not enough on its own for a STATIC face. Add it here
# too, or the browser synthesises it from a weight it has.
#
# latin-ext and vietnamese are dropped everywhere: the site is English and
# Bengali. Noto Sans Bengali's latin subsets are dropped too — it is listed
# AFTER the Latin faces in both stacks, so it is never reached for Latin text.
WANT = [
    # (family, Google wght spec, subset, {weight: output name})
    ('Archivo',            'wght@100..900', 'latin',   {'100 900': 'archivo-latin-var'}),
    ('Barlow',             'wght@400;700',  'latin',   {'400': 'barlow-latin-400',
                                                        '700': 'barlow-latin-700'}),
    ('Noto Sans Bengali',  'wght@100..900', 'bengali', {'100 900': 'noto-sans-bengali-var'}),
]

# The one piece of Bengali on an ENGLISH page is the language-switch label, and
# it is always the same three characters: বাং. Pulling the whole Bengali face to
# draw them cost 71 KB with Hind Siliguri and would cost 105 KB with Noto — on
# an English page that was 48% of its font weight, for three glyphs.
#
# Google's CSS2 API takes a `text=` parameter and returns a subset holding only
# those characters. For বাং at 700 that is 952 bytes, and the unicode-range comes
# back as U+982, U+9ac, U+9be. It ships under its own family name, because two
# @font-face rules on ONE family with overlapping unicode-ranges resolve to the
# last rule declared — the full face would win and the saving would vanish.
#
# Change the switch label and this subset no longer covers it. build.js has a
# guard, checkLangSwitchSubset(), that refuses the build in that case and sends
# the reader back here.
WANT_TEXT = [
    # (family, Google wght spec, the exact text, output name)
    ('Noto Sans Bengali', 'wght@700', 'বাং', 'noto-sans-bengali-switch-700'),
]

# The family these subsets are declared under in styles.css. Not the real family
# name, for the overlapping-range reason above. styles.css and build.js both
# know this string; it is written here because this is what emits the CSS.
SWITCH_FAMILY = 'Bengali Switch'


def fetch(url, binary=False):
    r = subprocess.run(['curl', '-sS', '--fail', '--max-time', '60', '-A', UA, url],
                       capture_output=True)
    if r.returncode != 0:
        sys.exit(f'curl failed for {url}\n{r.stderr.decode(errors="replace")}')
    return r.stdout if binary else r.stdout.decode()


def main():
    os.makedirs(OUT, exist_ok=True)
    faces, total = [], 0

    for family, spec, subset, names in WANT:
        css = fetch(f'https://fonts.googleapis.com/css2?family='
                    f'{family.replace(" ", "+")}:{spec}&display=swap')
        if '@font-face' not in css:
            sys.exit(f'Google rejected the request for {family} {spec}. '
                     f'The family may no longer offer those weights.')

        # Each block is preceded by a `/* subset */` comment; that comment is
        # the only thing identifying which subset a block is for.
        blocks = re.findall(r'/\* (\S+) \*/\s*@font-face \{(.*?)\}', css, re.S)
        found = set()

        for block_subset, body in blocks:
            if block_subset != subset:
                continue
            weight = re.search(r'font-weight: ([\d ]+);', body).group(1)
            if weight not in names:
                continue
            url = re.search(r'url\((https[^)]+)\)', body).group(1)
            urange = re.search(r'unicode-range: ([^;]+);', body).group(1)

            name = names[weight] + '.woff2'
            data = fetch(url, binary=True)
            with open(os.path.join(OUT, name), 'wb') as f:
                f.write(data)

            found.add(weight)
            total += len(data)
            print(f'  {name:34s} {len(data):7d} B', file=sys.stderr)
            faces.append((family, weight, name, urange))

        missing = set(names) - found
        if missing:
            sys.exit(f'{family}: Google returned no {subset} face for '
                     f'weight(s) {sorted(missing)}. Check the family still '
                     f'ships them before editing styles.css.')

    # The text= subsets. One block each, no /* subset */ comment to match on,
    # and the src URL is a generated /l/font?kit=... link rather than a path
    # ending .woff2 — which is why nothing here keys off the extension.
    for family, spec, text, name in WANT_TEXT:
        css = fetch(f'https://fonts.googleapis.com/css2?family='
                    f'{family.replace(" ", "+")}:{spec}'
                    f'&text={urllib.parse.quote(text)}&display=swap')
        if '@font-face' not in css:
            sys.exit(f'Google returned no face for {family} {spec} text={text!r}. '
                     f'A character outside the family is the usual cause.')

        url = re.search(r'url\((https[^)]+)\)', css).group(1)
        urange = re.search(r'unicode-range: ([^;]+);', css).group(1)
        weight = re.search(r'font-weight: ([\d ]+);', css).group(1)

        data = fetch(url, binary=True)
        with open(os.path.join(OUT, name + '.woff2'), 'wb') as f:
            f.write(data)

        total += len(data)
        print(f'  {name + ".woff2":34s} {len(data):7d} B   '
              f'({text} only)', file=sys.stderr)
        # Its own family name, so it cannot collide with the full face above.
        faces.append((SWITCH_FAMILY, weight, name + '.woff2', urange))

    print(f'\n  {len(faces)} files, {total} B ({total / 1024:.1f} KB)\n',
          file=sys.stderr)

    # Emitted rather than hand-written so the unicode-range values are Google's
    # own. Getting one wrong does not error — it silently stops a face being
    # used for the script it was fetched for.
    print('/* Generated by tools/fetch-web-fonts.py — do not hand-edit the '
          'unicode-range values. */')
    for family, weight, name, urange in faces:
        print(f'''@font-face {{
  font-family: "{family}";
  font-style: normal;
  font-weight: {weight};
  font-display: swap;
  src: url("../fonts/{name}") format("woff2");
  unicode-range: {urange};
}}''')


if __name__ == '__main__':
    main()
