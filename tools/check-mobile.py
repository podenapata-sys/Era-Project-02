#!/usr/bin/env python3
"""Check the phone experience of the built site. Run it by hand before pushing.

    node build.js && python3 tools/check-mobile.py

This exists because the mobile navigation was dead and nobody noticed. The
header carried `backdrop-filter`, which makes an element the containing block
for its position:fixed descendants, so the fixed `.nav` inside it resolved
top/bottom against the 85px header instead of the viewport and rendered 43px
tall holding 360px of content. Every nav link below the first was unreachable
on a phone. It shipped, it survived several rounds of screenshots, and it was
found only when the client said the dropdown did not work.

Screenshots did not catch it. An assertion does. Every check here is a thing
that has actually broken, or is one CSS declaration away from breaking:

  1. The menu opens to its full height and nothing in it is clipped.
  2. Every nav link, the language switch and the WhatsApp button are really
     inside the open menu's box — not merely present in the DOM.
  3. No tap target is under 44px. Twelve were, including both phone numbers.
  4. The call bar is there below 760px and gone at 1280px.
  5. No horizontal scroll at 390px.

Needs Playwright and a Chromium. It never writes to the repository.
"""

import asyncio
import os
import subprocess
import sys
import time

try:
    from playwright.async_api import async_playwright
except ImportError:
    sys.exit('playwright is not installed: pip install playwright')

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DIST = os.path.join(ROOT, 'dist')
PORT = 8799
PHONE = 390
DESKTOP = 1280

# Chromium ships with this image at a pinned path; fall back to whatever
# Playwright finds if it has been installed the usual way.
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

PAGES = [
    ('en', 'index.html'),
    ('bn', 'bn/index.html'),
    ('en', 'contact.html'),
    ('bn', 'bn/services/core-cutting/index.html'),
    # The About page carries the owner's portrait, the only component on the
    # site with a fixed-width box inside the text column — the one shape that
    # can push a narrow phone sideways. In Bengali, which sets wider.
    ('bn', 'bn/about.html'),
    # The products page, in both languages. It carries the item grid — eighty-
    # two cards, each one a tap target, and the densest layout on the site.
    # It was not in this sweep before the grid existed, which is exactly when a
    # page most needs to be in it.
    ('en', 'products.html'),
    ('bn', 'bn/products.html'),
]

fails = []


def fail(msg):
    fails.append(msg)


async def check_menu(pg, path, scroll):
    """The menu must open to a usable size with everything inside it."""
    await pg.evaluate(f'window.scrollTo(0, {scroll})')
    await pg.wait_for_timeout(250)
    await pg.click('#navToggle')
    await pg.wait_for_timeout(450)

    d = await pg.evaluate("""() => {
      const nav = document.querySelector('.nav');
      const r = nav.getBoundingClientRect();
      // "Inside" means inside the visible box, not merely in the DOM. The bug
      // left every link present and correct in the markup and off the screen.
      const inside = el => {
        const q = el.getBoundingClientRect();
        return q.height > 0 && q.top >= r.top - 1 && q.bottom <= r.bottom + 1;
      };
      const links = [...nav.querySelectorAll('.nav__list a')];
      const wa = nav.querySelector('.btn');
      return {
        open: nav.classList.contains('is-open'),
        height: Math.round(r.height),
        content: nav.scrollHeight,
        clipped: nav.scrollHeight > nav.clientHeight + 1,
        linkCount: links.length,
        linksInside: links.filter(inside).length,
        waInside: wa ? inside(wa) : false,
      };
    }""")

    where = f'{path} @{PHONE} scrollY={scroll}'
    if not d['open']:
        fail(f'{where}: the menu did not open')
        return
    if d['clipped']:
        fail(f"{where}: menu is CLIPPED — {d['height']}px box holding "
             f"{d['content']}px of content. An ancestor is probably "
             f"establishing a containing block (backdrop-filter, filter, "
             f"transform, perspective, will-change, contain).")
    if d['linksInside'] != d['linkCount']:
        fail(f"{where}: only {d['linksInside']} of {d['linkCount']} nav links "
             f"are inside the open menu")
    if not d['waInside']:
        fail(f'{where}: the WhatsApp button is not inside the open menu')

    await pg.click('#navToggle')
    await pg.wait_for_timeout(300)


async def check_langswitch_in_bar(pg, path):
    """The language switch rides in the header bar, not inside the menu.

    It used to sit in .nav__aside, which below 1025px is a fixed panel behind
    opacity:0 — so a Bengali reader landing on an English page had to work out
    that the three-line button hid the way back. The switch is out in the bar
    beside that button now, and this holds it there: visible with the menu
    shut, inside the header's own box, and right of the brand.
    """
    d = await pg.evaluate("""() => {
      // Two are in the markup, one per breakpoint; take whichever is on.
      const all = [...document.querySelectorAll('.langswitch')];
      const on = all.filter(e => getComputedStyle(e).display !== 'none');
      if (on.length !== 1) return { shownCount: on.length };
      const sw = on[0];
      const nav = document.querySelector('.nav');
      const head = document.querySelector('.site-header');
      const r = sw.getBoundingClientRect();
      const h = head.getBoundingClientRect();
      const brand = document.querySelector('.brand').getBoundingClientRect();
      const cs = getComputedStyle(sw);
      return {
        inNav: !!(nav && nav.contains(sw)),
        shown: cs.display !== 'none' && cs.visibility !== 'hidden' &&
               parseFloat(cs.opacity) > 0 && r.width > 0 && r.height > 0,
        inHeader: r.top >= h.top - 1 && r.bottom <= h.bottom + 1,
        afterBrand: r.left >= brand.right - 1,
        right: Math.round(r.right),
        vw: document.documentElement.clientWidth,
      };
    }""")

    where = f'{path} @{PHONE}'
    if 'shownCount' in d:
        fail(f"{where}: {d['shownCount']} language switches are visible — "
             f'exactly one of the bar and nav copies must be shown')
        return
    if d['inNav']:
        fail(f'{where}: the language switch is back inside the nav panel — '
             f'behind opacity:0 it cannot be reached without opening the menu')
    if not d['shown']:
        fail(f'{where}: the language switch is not visible with the menu shut')
    if not d['inHeader']:
        fail(f'{where}: the language switch is outside the header bar')
    if not d['afterBrand']:
        fail(f'{where}: the language switch overlaps the brand')
    if d['right'] > d['vw'] + 1:
        fail(f"{where}: the language switch runs {d['right'] - d['vw']}px "
             f"past the right edge")


async def check_targets_and_bar(pg, path, width):
    d = await pg.evaluate("""() => {
      const vis = el => {
        const cs = getComputedStyle(el);
        // offsetParent is always null for position:fixed, so it cannot be
        // used here — the call bar is fixed.
        return cs.display !== 'none' && cs.visibility !== 'hidden' &&
               el.getBoundingClientRect().height > 0;
      };
      // The quote form's honeypot is a real, focusable input parked at
      // x=-9999 on purpose: bots fill it, humans never see it. Padding it to
      // 44px would defeat it, so anything hidden off the left edge is not a
      // tap target and is skipped. Never widen this to display:none — that is
      // the trick the honeypot deliberately avoids.
      const onScreen = el => el.getBoundingClientRect().right > 0;
      const tappable = [...document.querySelectorAll('a,button,input,select,textarea')]
        .filter(e => e.getBoundingClientRect().height > 0 && vis(e) && onScreen(e));
      const small = tappable.filter(e => {
        const r = e.getBoundingClientRect();
        return r.height < 44 || r.width < 44;
      }).map(e => `${Math.round(e.getBoundingClientRect().width)}x` +
                  `${Math.round(e.getBoundingClientRect().height)} ` +
                  `${e.tagName.toLowerCase()} ${JSON.stringify(e.textContent.trim().slice(0, 20))}`);
      const bar = document.querySelector('.callbar');
      const de = document.documentElement;
      return {
        small,
        barShown: bar ? vis(bar) : false,
        hscroll: de.scrollWidth > de.clientWidth + 1,
      };
    }""")

    where = f'{path} @{width}'
    if width == PHONE:
        if d['small']:
            fail(f"{where}: {len(d['small'])} tap target(s) under 44px: " +
                 '; '.join(d['small'][:6]))
        if not d['barShown']:
            fail(f'{where}: the Call/WhatsApp bar is missing')
        if d['hscroll']:
            fail(f'{where}: the page scrolls horizontally')
    else:
        if d['barShown']:
            fail(f'{where}: the Call/WhatsApp bar should not show at desktop')


async def check_header_matches_across_languages(browser, widths):
    """Tapping the switch must not move the switch.

    The header is the one block that redraws in a different script, and the
    Bengali brand is wider than the English one. At 360px the Bengali tagline
    wrapped and the header went 85px -> 104px, so the control a reader had
    just tapped jumped 9px down the moment the new page painted. Nothing else
    here would catch it: each page on its own is fine, and the two are only
    wrong next to each other.
    """
    for width in widths:
        box = {}
        for lang, path in (('en', 'index.html'), ('bn', 'bn/index.html')):
            ctx = await browser.new_context(viewport={'width': width, 'height': 760},
                                            is_mobile=True, has_touch=True)
            pg = await ctx.new_page()
            await pg.goto(f'http://127.0.0.1:{PORT}/{path}', wait_until='load')
            await pg.evaluate('document.fonts.ready')
            box[lang] = await pg.evaluate("""() => {
              const h = document.querySelector('.site-header').getBoundingClientRect();
              const sw = [...document.querySelectorAll('.langswitch')]
                .find(e => getComputedStyle(e).display !== 'none');
              const r = sw.getBoundingClientRect();
              return { head: Math.round(h.height), top: Math.round(r.top) };
            }""")
            await ctx.close()

        if box['en']['head'] != box['bn']['head']:
            fail(f"@{width}: the header is {box['en']['head']}px in English and "
                 f"{box['bn']['head']}px in Bengali — switching language moves "
                 f"everything under it")
        if box['en']['top'] != box['bn']['top']:
            fail(f"@{width}: the language switch sits at y={box['en']['top']} in "
                 f"English and y={box['bn']['top']} in Bengali — it jumps out "
                 f"from under the finger that just tapped it")


async def check_stacked_grids(pg, path):
    """The page's big two-column grids are one column on a phone.

    Each of these splits into columns on a desktop and is collapsed again in
    the 1024px block. That block was once closed early by a narrower media
    query opened inside it, which left six of its rules — these among them —
    applying only below 390px. The hero then kept its desktop split from 390px
    to 1024px: a 169px column of text beside a 153px picture, with every
    heading and button inside it wrapping four lines deep.

    Nothing here noticed, because nothing here had ever looked at the hero.
    """
    d = await pg.evaluate("""() => {
      const out = [];
      for (const sel of ['.hero__grid', '.why__grid', '.about__grid', '.contact__grid']) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const cols = getComputedStyle(el).gridTemplateColumns.trim().split(/\\s+/);
        const kids = [...el.children].map(c => c.getBoundingClientRect());
        out.push({
          sel, n: cols.length,
          // Two children on one row is what a reader sees; the column count
          // alone could still be a single column that something else splits.
          sideBySide: kids.length > 1 && Math.abs(kids[0].top - kids[1].top) < 2,
          w: Math.round(kids.length ? kids[0].width : 0),
        });
      }
      return out;
    }""")

    for g in d:
        where = f"{path} @{PHONE} {g['sel']}"
        if g['n'] != 1 or g['sideBySide']:
            fail(f"{where}: still {g['n']} columns on a phone — its first child "
                 f"is {g['w']}px wide. It must stack.")


async def check_category_columns(pg, path):
    """Every category stacks, and its item cards sit at least two to a row.

    .cat splits into two columns on a desktop and the even ones reverse that
    split, which is a second rule setting the same property at higher
    specificity. A phone override written as a bare `.cat` loses to it, and the
    symptom is quiet: the page still fits, still scrolls straight, every tap
    target is still 44px, so nothing else in this file notices. What happens is
    that every second category keeps its desktop split and squeezes its items
    into a single column half the width, while its neighbours show two.
    """
    d = await pg.evaluate("""() => {
      return [...document.querySelectorAll('article.cat')].map(cat => {
        const ul = cat.querySelector('ul.items');
        const items = [...cat.querySelectorAll('li.item')];
        const r0 = items[0] && items[0].getBoundingClientRect();
        const r1 = items[1] && items[1].getBoundingClientRect();
        return {
          id: cat.id,
          catCols: getComputedStyle(cat).gridTemplateColumns.split(' ').length,
          itemCols: ul ? getComputedStyle(ul).gridTemplateColumns.split(' ').length : 0,
          // Two cards on one row is the thing a reader actually sees; the
          // computed column count alone could still lie about wrapping.
          sideBySide: !!(r0 && r1) && Math.abs(r0.top - r1.top) < 2,
        };
      });
    }""")

    for c in d:
        where = f"{path} @{PHONE} #{c['id']}"
        if c['catCols'] != 1:
            fail(f"{where}: the category is still {c['catCols']} columns wide on a "
                 f"phone — it must stack to one")
        if c['itemCols'] < 2 or not c['sideBySide']:
            fail(f"{where}: item cards are {c['itemCols']} to a row — a phone "
                 f"should fit at least two")


async def main():
    if not os.path.isdir(DIST):
        sys.exit('dist/ is missing — run `node build.js` first.')

    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', DIST],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)
    try:
        async with async_playwright() as pw:
            launch = {'executable_path': CHROME} if os.path.exists(CHROME) else {}
            browser = await pw.chromium.launch(**launch)
            for width in (PHONE, DESKTOP):
                for _lang, path in PAGES:
                    ctx = await browser.new_context(
                        viewport={'width': width, 'height': 844},
                        is_mobile=(width == PHONE), has_touch=(width == PHONE))
                    pg = await ctx.new_page()
                    await pg.goto(f'http://127.0.0.1:{PORT}/{path}', wait_until='load')
                    await pg.evaluate('document.fonts.ready')
                    if width == PHONE:
                        # Both scroll positions: the header is sticky, so
                        # --header-bottom differs between them and the menu has
                        # to survive either.
                        await check_langswitch_in_bar(pg, path)
                        for scroll in (0, 600):
                            await check_menu(pg, path, scroll)
                        await check_stacked_grids(pg, path)
                        await check_category_columns(pg, path)
                    await check_targets_and_bar(pg, path, width)
                    await ctx.close()
            # 320 and 360 are below the width where the Bengali tagline fits,
            # 390 and 412 above it; the header has to match across the switch
            # on both sides of that line.
            await check_header_matches_across_languages(browser, (320, 360, 375, 390, 412))
            await browser.close()
    finally:
        srv.terminate()

    if fails:
        print(f'FAILED — {len(fails)} problem(s):\n')
        for f in fails:
            print(f'  - {f}')
        sys.exit(1)
    print(f'PASS — the language switch rides in the header bar with the menu '
          f'shut; menu opens unclipped with every link '
          f'and the WhatsApp button inside it at both scroll positions; no tap '
          f'target under 44px; call bar present at {PHONE}px and absent at '
          f'{DESKTOP}px; no horizontal scroll; every category stacked with at '
          f'least two item cards to a row; the hero, why, about and contact '
          f'grids stacked; the header the same height in both '
          f'languages at 320-412px. Checked {len(PAGES)} pages.')


if __name__ == '__main__':
    asyncio.run(main())
