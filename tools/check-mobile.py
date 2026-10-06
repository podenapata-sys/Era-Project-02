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
      const lang = nav.querySelector('.langswitch a');
      return {
        open: nav.classList.contains('is-open'),
        height: Math.round(r.height),
        content: nav.scrollHeight,
        clipped: nav.scrollHeight > nav.clientHeight + 1,
        linkCount: links.length,
        linksInside: links.filter(inside).length,
        waInside: wa ? inside(wa) : false,
        langInside: lang ? inside(lang) : false,
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
    if not d['langInside']:
        fail(f'{where}: the language switch is not inside the open menu')

    await pg.click('#navToggle')
    await pg.wait_for_timeout(300)


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
                        for scroll in (0, 600):
                            await check_menu(pg, path, scroll)
                    await check_targets_and_bar(pg, path, width)
                    await ctx.close()
            await browser.close()
    finally:
        srv.terminate()

    if fails:
        print(f'FAILED — {len(fails)} problem(s):\n')
        for f in fails:
            print(f'  - {f}')
        sys.exit(1)
    print(f'PASS — menu opens unclipped with every link, the language switch '
          f'and the WhatsApp button inside it at both scroll positions; no tap '
          f'target under 44px; call bar present at {PHONE}px and absent at '
          f'{DESKTOP}px; no horizontal scroll. Checked {len(PAGES)} pages.')


if __name__ == '__main__':
    asyncio.run(main())
