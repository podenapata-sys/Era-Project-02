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
# Barlow and Hind Siliguri are static — Google rejects a `wght@100..900`
# request for both — so each weight is its own file.
#
# Barlow is fetched at 400 and 700 ONLY. Every other weight in styles.css —
# the eleven 600s and the one 500 — sits under a rule that sets --font-display,
# so it resolves to Archivo's variable file, never to Barlow. Verified two ways:
# statically, by resolving the family for each of those rules, and empirically,
# by crawling all 32 public pages to the bottom and recording which files the
# browser actually requested. Barlow 500 and 600 were requested by none.
#
# Hind Siliguri 500 is deliberately NOT fetched either. Its only user is
# `.rev figcaption span` (display family, so Bengali falls through to Hind), and
# reviews.json is empty, so it falls to an adjacent weight invisibly. 71 KB.
#
# If reviews ever land and the 500 weight should be real, add it back here —
# don't just change the CSS, or the browser synthesises the weight instead.
#
# latin-ext and vietnamese are dropped everywhere: the site is English and
# Bengali. Hind Siliguri's latin subsets are dropped too — it is listed AFTER
# the Latin faces in both stacks, so it is never reached for Latin text.
WANT = [
    # (family, Google wght spec, subset, {weight: output name})
    ('Archivo',       'wght@100..900',        'latin',   {'100 900': 'archivo-latin-var'}),
    ('Barlow',        'wght@400;700',         'latin',   {'400': 'barlow-latin-400',
                                                          '700': 'barlow-latin-700'}),
    ('Hind Siliguri', 'wght@400;500;600;700', 'bengali', {'400': 'hind-siliguri-bengali-400',
                                                          '600': 'hind-siliguri-bengali-600',
                                                          '700': 'hind-siliguri-bengali-700'}),
]


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
