# Photographs: what to shoot, what to generate, and the prompts

Twenty-two images cover the whole site, and **twenty-one of them are below**.
The twenty-second is `owner.jpg`, the portrait of the shop's owner on the About
page. It is a real photograph of a real person, supplied by the client, and it
must never be generated or replaced with a stock face — so it has no prompt here
and no entry below.

The twenty-one in this file are all still dashed placeholders — nine on the home
page alone, a quarter of the page on a phone. This file gets them filled.

## How to use it

1. Produce an image for a slot below.
2. Save it into `photos-inbox/` named **exactly** as the heading says —
   `cat-ceramic.jpg`, `trade-core-cutting.jpg`. The extension does not matter.
3. Run `python3 tools/add-photos.py`.

That one command applies the phone's rotation flag, crops the source to every
shape the site needs, **strips the GPS coordinates out of the file**, and writes
WebP plus a JPEG fallback at two or three widths. Partial deliveries are fine —
whatever is in the inbox gets processed and the rest keep their placeholders.

`python3 tools/add-photos.py --status` prints what is still missing.

## Launch order — generate 18, shoot 3

For a launch on a deadline, the split is not even. **Three photographs cannot be
generated and must be shot; the other eighteen are better generated than shot.**

| | how | why |
| --- | --- | --- |
| `shopfront`, `counter`, `stock` | **shoot, 20 minutes** | they are pictures of *this* shop; a generated one is rule 2 |
| 7 × `cat-*` | **generate** | a clean studio group beats a phone photo of a dim shelf |
| 11 × `trade-*` | **generate** | nobody has a photo library of finished jobs yet |

Generate in this order, so that if you run out of time the pages that carry the
most traffic are the ones that got filled:

1. **`cat-cpvc`, `cat-upvc`, `cat-pressure`** — the three pipe categories.
   They are the top of the home page grid and they are what the shop is known
   for.
2. **`cat-bathroom-fittings`, `cat-ceramic`, `cat-kitchen`, `cat-accessories`**
   — the rest of the home and products grids. After these, the two
   highest-traffic pages have no placeholders left.
3. **`trade-plumbing`, `trade-core-cutting`** — the two trades customers ask
   for most, and the two trade pages most likely to be linked directly.
4. **The remaining nine trades.** Each one only fills its own page plus a card
   in the services grid, so these are the cheapest to be late with.

Eighteen prompts at roughly a minute each is an evening's work, not a week's.

## The rules that apply to all of them

**Always ask ChatGPT for a landscape image.** This is the single most important
line in this file. ChatGPT gives you 1792×1024 (landscape), 1024×1024 (square)
or 1024×1792 (portrait). Each source here gets cropped to *two different shapes*
by the tool, and only landscape is large enough to survive both:

| | what it is cropped to | 1792×1024 landscape | 1024×1024 square |
| --- | --- | --- | --- |
| a category | 16:9 and 4:3 | fine | too small, blurs |
| a trade | 4:3 and 16:10 | fine | too small, blurs |

**The tool now refuses anything too small, so check before you generate.**
`add-photos.py` used to enlarge an undersized file without a word, which is how
a batch of product shots saved off another company's website got as far as being
processed. It now names the file and the shortfall and skips it. The numbers it
enforces, measured rather than guessed:

| source | categories (16:9 + 4:3) | shop photos (4:3 + 5:4) |
| --- | --- | --- |
| 1792×1024 | passes | fails — 1365px against 1440 |
| 1536×1024 | passes | fails — 1365px against 1440 |
| 1344×768 | **fails** — 1024px against 1120 | fails |
| 1024×1024 | **fails** | fails |

**Gemini's size is a tier, not a sentence in the prompt.** Gemini 3 Pro Image
offers 1K, 2K and 4K, and the tier is a total pixel budget spread across
whatever aspect ratio is chosen — about 1, 4 and 16 megapixels. At 3:2 that
lands on:

| tier | pixels | area |
| --- | --- | --- |
| 1K | 1264×848 | 1,071,872 ≈ 1024² |
| 2K | 2528×1696 | 4,287,488 ≈ 2048² |
| 4K | ≈5056×3392 | ≈4096² |

Which is how a batch gets diagnosed without asking anyone: multiply the two
numbers and see which square it is near. The fourteen bathroom-fittings images
came back at 1264×848 from prompts that asked in writing for 1536×1024 or
larger, because no wording reaches that control.

The app's own settings panel offers five aspect ratios and no resolution at
all, so the tier may not be reachable from there. Run through the guard, the
five ratios at the default tier come out:

| at 1K | pixels | item (1:1) | category | trade |
| --- | --- | --- | --- | --- |
| 16:9 | 1365×768 | fails, 768 | fails | fails |
| 4:3 | 1182×887 | fails, 887 | fails | fails |
| **1:1** | **1024×1024** | **passes** | fails | fails |
| 3:4 | 887×1182 | fails, 887 | fails | fails |
| 9:16 | 768×1365 | fails, 768 | fails | fails |

**So item images are asked for as 1:1 and nothing else.** That is the one shape
large enough at the default tier, it is also large enough at 2K, and it is the
only shape an item is ever shown in — asking for landscape and cutting a square
out of it was always the long way round, and it is what sliced the first C-PVC
banner. Square in, square out, nothing cropped, no tier to remember.

Category and trade images have no such escape: they are cut to 4:3, 5:4, 16:9
and 16:10, so the source must be landscape, and no landscape ratio is big
enough at 1K. Those need 2K, and if the tier cannot be reached the picture
cannot come from that surface. 4K is never needed — four times the file for
pixels nothing displays.

The shop photographs are a separate matter and not a resolution one. `shopfront`
says "The ERA Sanitary shop on D.I.T Road, Rampura", `counter` and `stock`
describe that shop's own counter and racks — no generator can make those
sentences true at any tier. They have to be photographed.

Note the test is on the *crop*, not the file: 1024×1792 has more pixels than
1792×1024 and still fails, because the 4:3 cut throws the height away.

**Leave empty margin around the subject.** The same frame becomes a wide strip
*and* a near-square. Anything close to an edge gets cut off. Every prompt below
already says this; do not delete that sentence when you edit one.

**Ask for a cluster, not a line — this is the one that actually bit.** The
margin sentence above is not enough on its own. Three of the first seven
category prompts said the items were "evenly spaced with clear space between
them", and ChatGPT read that as a **single wide row**. A row of five or more
objects fills the frame edge to edge whatever the prompt says about margin, and
the 4:3 crop then sliced the end items off: `cat-ceramic` lost half a commode,
`cat-bathroom-fittings` lost the shower set, `cat-accessories` lost the towel
rail. They had to be rescued by padding the source.

So word the arrangement as a **compact, roughly square group — two or three
staggered rows, tallest pieces at the back, smallest in front**. That is what
lets a dozen items fit without the group growing wider than a 4:3 box. More
items in a line is strictly worse; more items in a cluster is free.

**No text, no logos, no brand names, no packaging labels.** Two reasons. AI
renders lettering as nonsense, and a legible fake brand would be a claim that
ERA stocks something it may not. The prompts handle this by asking for plain,
unmarked surfaces rather than by saying "no logos" — ChatGPT often produces the
thing you tell it to avoid, so the exclusions are written as positives.

**Set it in Bangladesh.** A generated American warehouse aisle reads as fake to
the Dhaka contractor it is supposed to convince.

**Three things to do in ChatGPT itself:** ask for landscape, send one prompt per
message, and regenerate rather than replying "make it more…", which drifts away
from the brief. Each prompt starts by telling it not to rewrite the prompt,
because it will otherwise.

---

# 1. The three you must photograph, not generate

`shopfront`, `counter` and `stock` are pictures of **this business**. A
generated shopfront is the exact thing `RULES.md` rule 2 forbids: a customer
uses that image to recognise the shop from the street, and a convincing fake
walks them straight past it. It is also the only image on the site that proves
ERA is a real place with real stock, which is what a contractor is deciding.

ChatGPT could not do these anyway — the largest crop the site needs is 1440px
wide and ChatGPT's best is 1365px.

Twenty minutes with your phone covers all three. Shoot **landscape**, hold
still, do not use zoom (step closer instead), and do not worry about the GPS
tag — the tool removes it.

### `shopfront.jpg` — the shop from the street

Stand across the road, far enough back that the **whole sign is readable** and
you can see the shop sits on D.I.T Road. Mid-morning or late afternoon; midday
sun blows out the sign and a night shot hides the building. Shutter open, lights
on, nothing parked across the front if you can help it. Leave room above the
sign and on both sides — this is cropped twice and a tight frame loses the name.

### `counter.jpg` — the counter, or an order going out the door

The serving counter with stock visible behind it. Best version is mid-activity:
an order being handed over, boxes stacked ready to go. Shoot from customer
height, slightly to one side so you see depth rather than a flat wall. If a
person is in frame, get their okay first.

### `stock.jpg` — the range, in one frame

The one that does the most work: it runs across the top of the products page.
A wall or rack of pipe and fittings deep enough that the **range** is obvious —
different diameters, different fittings, well filled. Straight on, whole rack in
frame, as much light as you can get. This is the picture that answers "will they
have my size".

---

# 2. Product categories — seven prompts

Each is shown as a wide card on the home and products pages, and as a larger
block on the products page.

**All seven share one setting** — a polished concrete floor, a plain pale wall,
daylight from a window off frame, a blurred plant at the edge — so the seven read
as one shoot rather than seven stock photographs. The look came from an image the
client generated; what changed on the way in was the composition.

**Centred, not off to one side.** The client's version put the group in the right
60% of the frame with a headline filling the left. That reads beautifully as a
Facebook banner and is unusable here, because every category image is cut twice
and the 4:3 cut takes 210px off each side — enough to slice the left of a
headline clean off. The group goes in the middle; the words go in the page, where
they are real text in the site's own font and in both languages.

**At least 1024 pixels tall.** `sq43` asks for 1120×840 at its largest, so 840 is
the hard floor and 1024 is the headroom. `add-photos.py` refuses anything under
it rather than publishing a blurred crop.

### `cat-cpvc.jpg` — C-PVC pipes & fittings (1/2"–6")

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 4:3 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A catalogue photograph of cream-beige C-PVC plumbing parts: several lengths of cream pipe standing upright at the back in stepped heights, each with a thin red identification stripe running along it, and in front of them 90-degree and 45-degree elbows, tees, sockets, reducers, a union, a brass-threaded adapter and a ball valve with a red lever handle, arranged as a compact, roughly square group in two staggered rows — the tallest pieces at the back, the smallest in front — with clear space between the pieces but the group as a whole kept tight rather than spread into a line. The group stands on a polished pale concrete floor in a bright modern interior, a large plain pale concrete wall behind it, a tall window out of frame to one side throwing soft daylight and a gentle diagonal patch of light across the wall, and a blurred green plant at the far edge, well out of focus. Soft reflection of the pieces in the polished floor, gentle contact shadows, shallow depth of field behind. Sharp focus on the products. Every surface plain, smooth and unmarked, with no writing, lettering, headline, tagline or logo anywhere in the picture. The whole group sits in the centre of the frame with generous empty margin to the left and to the right, so it can be cropped to a wide strip or to a square without cutting anything off.

### `cat-upvc.jpg` — U-PVC pipes & fittings (1.25"–12")

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 4:3 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A catalogue photograph of U-PVC soil and drainage parts: three wide drainage pipes of different diameters standing at the back, one grey and the others white, and in front of them a long-radius bend, a Y-tee, a P-trap, a pipe clip and a vent cowl, all plain unmarked plastic, arranged as a compact, roughly square group in two staggered rows — the tallest pieces at the back, the smallest in front — with clear space between the pieces but the group as a whole kept tight rather than spread into a line. The group stands on a polished pale concrete floor in a bright modern interior, a large plain pale concrete wall behind it, a tall window out of frame to one side throwing soft daylight and a gentle diagonal patch of light across the wall, and a blurred green plant at the far edge, well out of focus. Soft reflection of the pieces in the polished floor, gentle contact shadows, shallow depth of field behind. Sharp focus on the products. Every surface plain, smooth and unmarked, with no writing, lettering, headline, tagline or logo anywhere in the picture. The whole group sits in the centre of the frame with generous empty margin to the left and to the right, so it can be cropped to a wide strip or to a square without cutting anything off.

### `cat-pressure.jpg` — Pressure PVC-U (1/2"–4")

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 4:3 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A catalogue photograph of white pressure PVC-U plumbing parts: two thick-walled white pressure pipes of different diameters standing at the back, and in front of them a plain coupling, a reducing coupling, a female socket with an internal thread, a plain ninety-degree elbow, an elbow with a brass female thread, a plain tee, a reducing tee, a union with its ring nut, a male adapter, an end cap and a white ball valve with a red lever handle, the walls visibly heavier than drainage pipe, arranged as a compact, roughly square group in two staggered rows — the tallest pieces at the back, the smallest in front — with clear space between the pieces but the group as a whole kept tight rather than spread into a line. The group stands on a polished pale concrete floor in a bright modern interior, a large plain pale concrete wall behind it, a tall window out of frame to one side throwing soft daylight and a gentle diagonal patch of light across the wall, and a blurred green plant at the far edge, well out of focus. Soft reflection of the pieces in the polished floor, gentle contact shadows, shallow depth of field behind. Sharp focus on the products. Every surface plain, smooth and unmarked, with no writing, lettering, headline, tagline or logo anywhere in the picture. The whole group sits in the centre of the frame with generous empty margin to the left and to the right, so it can be cropped to a wide strip or to a square without cutting anything off.

### `cat-bathroom-fittings.jpg` — Bathroom fittings (brass & CP finish)

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 4:3 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A catalogue photograph of polished chrome bathroom taps, mixers and fittings: a basin mixer, a bath mixer, a shower mixer, a pillar cock, a bib cock, a long-body tap, a concealed stop cock, a small angle valve, a round rain shower head, a push shower, a hand-shower set on its slide rail with a flexible hose, a health faucet, a bottle trap and a basin waste, arranged as a compact, roughly square group in two staggered rows — the tallest pieces at the back, the smallest in front — with clear space between the pieces but the group as a whole kept tight rather than spread into a line. The group stands on a polished pale concrete floor in a bright modern interior, a large plain pale concrete wall behind it, a tall window out of frame to one side throwing soft daylight and a gentle diagonal patch of light across the wall, and a blurred green plant at the far edge, well out of focus. Soft reflection of the pieces in the polished floor, gentle contact shadows, shallow depth of field behind. Sharp focus on the products. Every surface plain, smooth and unmarked, with no writing, lettering, headline, tagline or logo anywhere in the picture. The whole group sits in the centre of the frame with generous empty margin to the left and to the right, so it can be cropped to a wide strip or to a square without cutting anything off.

### `cat-accessories.jpg` — Plumbing accessories & hardware

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 4:3 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A catalogue photograph of bathroom hardware and plumbing fittings: a straight stainless towel rail, a towel rack with a shelf above its rail, a towel ring, a soap dish, a tissue holder with a plain white roll, a tumbler holder with a clear glass, a coat hook, a clear glass shelf on its brackets, a square floor grating, a plain white roll of PTFE thread tape, a short braided connector hose, a water tank connector, a brass float valve with its ball, a long braided flexible hose and two pipe clamps, arranged as a compact, roughly square group in three staggered rows — the tallest pieces at the back, the smallest in front — with clear space between the pieces but the group as a whole kept tight rather than spread into a line. The group stands on a polished pale concrete floor in a bright modern interior, a large plain pale concrete wall behind it, a tall window out of frame to one side throwing soft daylight and a gentle diagonal patch of light across the wall, and a blurred green plant at the far edge, well out of focus. Soft reflection of the pieces in the polished floor, gentle contact shadows, shallow depth of field behind. Sharp focus on the products. Every surface plain, smooth and unmarked, with no writing, lettering, headline, tagline or logo anywhere in the picture. The whole group sits in the centre of the frame with generous empty margin to the left and to the right, so it can be cropped to a wide strip or to a square without cutting anything off.

### `cat-ceramic.jpg` — Ceramic items

> **Confirm “low commode” with the shop before generating.** It is written here
> as a squat pan, which is what the term usually means in a Dhaka sanitary
> shop and what sits sensibly beside the wall-hung and floor-type commodes
> already in the list. If ERA means a low-level cistern WC instead, the image
> would misrepresent the stock — which is rule 2. One question answers it.

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 4:3 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A catalogue photograph of white ceramic sanitaryware: a wall-hung commode, a floor-standing commode with its cistern, a squat pan set flat with moulded foot platforms either side, a wall-hung urinal, a taller floor-standing urinal, a full-size pedestal basin, a round counter-top basin and a small compact cloakroom basin, arranged as a compact, roughly square group in two staggered rows — the tallest pieces at the back, the smallest in front — with clear space between the pieces but the group as a whole kept tight rather than spread into a line. The group stands on a polished pale concrete floor in a bright modern interior, a large plain pale concrete wall behind it, a tall window out of frame to one side throwing soft daylight and a gentle diagonal patch of light across the wall, and a blurred green plant at the far edge, well out of focus. Soft reflection of the pieces in the polished floor, gentle contact shadows, shallow depth of field behind. Sharp focus on the products. Every surface plain, smooth and unmarked, with no writing, lettering, headline, tagline or logo anywhere in the picture. The whole group sits in the centre of the frame with generous empty margin to the left and to the right, so it can be cropped to a wide strip or to a square without cutting anything off.

### `cat-kitchen.jpg` — Kitchen items

> **One item from the copy is deliberately not in this prompt.** “Kitchen
> accessories” is a catch-all, and whatever a generator draws for it becomes a
> claim about specific stock. Showing a subset of the list is fine; showing
> something the shop may not carry is not.

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 4:3 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A catalogue photograph of kitchen fittings: a double-bowl stainless steel sink, a single-bowl stainless steel sink, a dark grey moulded fibre sink, a white ceramic sink, a stainless workstation sink with a chopping board resting on its inner ledge, a tall chrome sink mixer with a curved spout, a basket strainer waste, a stainless steel gas stove with two burners and plain black burner caps, and a stainless steel chimney-style kitchen hood, arranged as a compact, roughly square group in three staggered rows — the tallest pieces at the back, the smallest in front — with clear space between the pieces but the group as a whole kept tight rather than spread into a line. The group stands on a polished pale concrete floor in a bright modern interior, a large plain pale concrete wall behind it, a tall window out of frame to one side throwing soft daylight and a gentle diagonal patch of light across the wall, and a blurred green plant at the far edge, well out of focus. Soft reflection of the pieces in the polished floor, gentle contact shadows, shallow depth of field behind. Sharp focus on the products. Every surface plain, smooth and unmarked, with no writing, lettering, headline, tagline or logo anywhere in the picture. The whole group sits in the centre of the frame with generous empty margin to the left and to the right, so it can be cropped to a wide strip or to a square without cutting anything off.

---

# 3. Trades — eleven prompts

Each appears as a card in the services grid and again as a wide strip across the
top of its own page.

**These are the weakest of the twenty-one.** They show the kind of work, not
ERA's work. A phone photo of a real finished job beats any of them and costs
nothing — use these until you have those, then replace them one by one.

All eleven use **hands and tools, no faces**. That avoids implying a generated
person is your crew, and avoids the mangled faces these models produce.

### `trade-plumbing.jpg` — Plumbing & sanitary work

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 16:9 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A documentary photograph of plumbing work in progress inside an unfinished concrete apartment in Dhaka, Bangladesh. Close on a pair of working hands tightening a fitting on a run of cream C-PVC pipe clipped to a bare plaster wall; a pipe wrench and a coil of thread tape rest on the floor nearby. Daylight from an open window, warm and slightly dusty, natural shadows. The hands and the pipe junction sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked pipe and tools. Realistic, sharp, no faces in the picture.

### `trade-tiles-marble-granite.jpg` — Tiles, marble & granite work

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 16:9 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A documentary photograph of floor tiling in progress in an unfinished room in Dhaka, Bangladesh. Close on working hands lowering a large polished tile into fresh adhesive, a notched trowel and tile spacers beside them, a straight line of already-laid tiles running away to one side. Daylight from a window, warm natural tone, fine dust in the air. The hands and the tile sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked tiles and tools. Realistic, sharp, no faces in the picture.

### `trade-core-cutting.jpg` — Core cutting work

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 16:9 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A documentary photograph of concrete core drilling in an unfinished building in Dhaka, Bangladesh. A core drilling rig bolted to a bare concrete wall, its cylindrical diamond core bit part-way through, a clean circular hole already cut beside it with the concrete core lying on the floor, water running down the wall from the cut. Gloved hands on the rig handle. Daylight, grey concrete, wet surfaces catching the light. The drill head and the cut hole sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked equipment. Realistic, sharp, no faces in the picture.

### `trade-deep-tube-well.jpg` — Deep tube well work

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 16:9 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A documentary photograph of tube well boring on an open building site in Dhaka, Bangladesh. A vertical drilling mast over a bore hole, lengths of steel casing pipe stacked on the ground, muddy water pooled around the hole, a submersible pump and coiled discharge pipe waiting to one side. Working hands guiding a casing pipe into the bore. Bright overcast daylight, wet earth, plain steel. The bore hole and the casing sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked equipment. Realistic, sharp, no faces in the picture.

### `trade-swimming-pool.jpg` — Swimming pool work

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 16:9 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A documentary photograph of swimming pool plumbing under construction in Dhaka, Bangladesh. An empty concrete pool shell with white PVC circulation pipes running along the floor and up the wall to inlet fittings, a filter housing and valve manifold standing at the poolside, working hands fitting a union onto the manifold. Bright daylight, grey concrete, clean white pipe. The valve manifold sits in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked pipe and equipment. Realistic, sharp, no faces in the picture.

### `trade-damp-proofing.jpg` — Damp proofing work

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 16:9 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A documentary photograph of damp proofing work on a ground-floor wall in Dhaka, Bangladesh. Close on working hands brushing a thick dark bituminous damp-proof coating onto bare brickwork at floor level, the treated section visibly darker than the untreated brick beside it, a bucket of coating and a wide brush on the floor. Daylight from one side, raking across the wall to show texture. The brush and the edge between treated and untreated wall sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked tools and containers. Realistic, sharp, no faces in the picture.

### `trade-water-proofing.jpg` — Water proofing work

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 16:9 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A documentary photograph of roof waterproofing in progress in Dhaka, Bangladesh. Working hands rolling a grey cementitious waterproof membrane onto a flat concrete roof slab, the coated area a clearly different shade from the bare concrete, a roller tray and a parapet upstand already coated behind. Strong daylight, flat concrete, long shadows. The roller and the coating edge sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked tools and containers. Realistic, sharp, no faces in the picture.

### `trade-electric.jpg` — Electric work

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 16:9 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A documentary photograph of electrical work in an unfinished apartment in Dhaka, Bangladesh. Close on working hands terminating coloured wires into a wall-mounted consumer unit with a neat row of plain circuit breakers, conduit running up the bare plaster wall, a screwdriver and a wire stripper resting on the board. Daylight from a window, cool neutral tone. The consumer unit and the hands sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked breakers and tools, no writing on anything. Realistic, sharp, no faces in the picture.

### `trade-painting.jpg` — Painting work

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 16:9 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A documentary photograph of interior painting in progress in Dhaka, Bangladesh. Close on working hands rolling pale paint onto a prepared interior wall, a crisp wet edge between the fresh coat and the duller putty-filled surface beside it, a roller tray and a putty knife on a dust sheet below. Soft daylight from a window, clean and bright. The roller and the wet edge sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked tins and tools. Realistic, sharp, no faces in the picture.

### `trade-thai-glass.jpg` — Thai Glass work

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 16:9 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A documentary photograph of glass partition installation in Dhaka, Bangladesh. Two pairs of gloved hands guiding a large clear glass panel into a slim aluminium frame, suction cup handles gripping the glass, a finished glass partition visible behind. Bright daylight through the glass, clean reflections, pale aluminium. The panel edge and the frame channel sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked glass and framing. Realistic, sharp, no faces in the picture.

### `trade-civil.jpg` — Civil work

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 16:9 and the output to 2K before generating — at the default 1K every landscape shape comes out too small to use.
>
> A documentary photograph of brickwork and plastering in Dhaka, Bangladesh. Close on working hands laying a red clay brick into a fresh mortar bed on a rising wall, a trowel and a spirit level in frame, a half-plastered section of the same wall behind showing the smooth grey finish over the brick. Warm daylight, dusty air, red brick against grey mortar. The hands and the brick course sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked tools. Realistic, sharp, no faces in the picture.

---

---

# 4. Item images — one plate, 81 swaps

The client's reference image is a **poster**, not a website image, and the
difference decides everything below. Its headline owns the right third and its
ribbon the bottom-left. This site cuts every source twice — 16:9 for the cards,
4:3 for the product blocks — so a 4:3 crop of that layout loses the badge column
and a 16:9 crop loses the ribbon. What makes it a good Facebook post is exactly
what makes it unusable as `cat-ceramic.jpg`.

So the text never gets generated. **Generate a clean plate, set the type over it
afterwards** in Canva or DaVinci, where it is sharp, in the shop's own font, and
editable per item. The reference got a clean render of its lettering; that is
luck, not the normal output. And a legible brand on a box is a claim that ERA
stocks that brand — rule 1. A generic descriptor is fine; a logo is not.

These 43 images have **no slot on the website**. The item lists render as text
chips. They are marketing stock for Facebook and WhatsApp, and the website is
unaffected by all of them.

## Build each prompt from three parts

    [ FRAME ]  +  [ SUBJECT ]  +  [ FINISH ]

**FRAME-SITE** — for anything going into `photos-inbox/`:

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 1:1 square before generating — this picture is used as a square, and a landscape one comes out too short to use. A catalogue photograph of SUBJECT. Where the subject is more than one piece, keep them as a compact group, overlapping slightly and turned towards the camera, never spread out in a line across the frame. The whole subject sits in the middle of the frame with a comfortable margin on every side, so nothing touches the edge.

**Why the arrangement sentence is in there.** An item image is cropped to a
**square**, and a square cut out of a 1536-wide frame throws away **256px from
each side**. The first one generated — three C-PVC pipes — came back as a
diagonal line running off to the right, and the square crop took the far ends of
two of the three. Pipes survive that; a tee loses a branch and a row of three
angle valves loses a valve outright. **44 of the 81 subjects have more than one
piece in frame**, and this is the same failure that wrecked `cat-ceramic`,
`cat-bathroom-fittings` and `cat-accessories` and had to be rescued by padding.
The seven category prompts have carried a clause against it since then; the item
frame did not, until it was tested.

**FRAME-POSTER** — for a Facebook or WhatsApp post, never for the website:

> Use this prompt exactly as written; do not rewrite or embellish it. Set the aspect ratio to 16:9 before generating. A catalogue photograph of SUBJECT. The subject sits in the left 60% of the frame. The right third is empty background — no product, no props, nothing in it — leaving clear space for a headline to be added later.

They must be **separate generations**. Shifting the subject left to make room for
text puts it straight under the 4:3 centre crop, so a poster plate cannot be
reused on the site.

**FINISH** — the reference's look, appended to either frame:

> The subject stands on a pale grey-white marble counter top with soft natural veining, with a softly blurred cool blue-grey interior behind it, well out of focus. Diffused light from the left, a gentle highlight down each piece, soft contact shadows and a faint reflection in the polished stone. Sharp focus on the product, shallow depth of field behind it. Every surface plain, smooth and unmarked, with nothing written or printed on anything in the picture.

## The loop: ChatGPT makes the plate, Gemini swaps the part

Generating 43 items from scratch gives 43 slightly different marbles. Instead:

1. **ChatGPT** — generate the category's master plate once, with FRAME + FINISH.
2. **Gemini** — upload that plate and edit it, once per item:

> Keep the background, the marble, the lighting, the camera angle and the framing exactly as they are. Replace the product with SUBJECT. Change nothing else.

Gemini holds a reference frame far better than it invents one, so the whole
category comes out looking like one shoot and each item costs one sentence.
Remember the size floor above: if Gemini returns a frame smaller than the plate,
it is a poster, not a website image.

## Bathroom fittings — 14

Three of these render identically unless they are written apart, which is the
whole reason the descriptions are this specific: a **bib cock** is wall-mounted
with a downturned nozzle, a **pillar cock** rises from the basin deck, and a
**long body tap** is wall-mounted with a long horizontal spout for a bucket.

| item | SUBJECT |
| --- | --- |
| **Shower mixers** | one chrome shower mixer: a horizontal body with a side handle at each end and an upward outlet for the riser, a short diverter spout below |
| **Bath mixers** | one chrome bath mixer with a long curved spout, a cross handle either side, and a shower diverter on top |
| **Basin mixers** | one tall chrome basin mixer, a single lever on top, a slim curved spout, a round deck flange |
| **Concealed stop cocks** | one chrome concealed stop cock: a round wall escutcheon plate with a short spindle and a lever handle, its brass body lying beside the plate to show what goes in the wall |
| **Bib cocks** | one chrome bib cock, wall type: a horizontal threaded inlet, a short body turning down to a nozzle, a quarter-turn lever on top |
| **Pillar cocks** | one chrome pillar cock standing upright on its deck flange, a single straight body rising to a short curved spout, lever handle on top |
| **Long body taps** | one chrome long body tap, wall type, with an unusually long straight horizontal spout for filling a bucket, lever handle at the wall end |
| **Shower sets** | one chrome hand shower clipped to its slide rail, a braided flexible hose coiled below, a wall bracket at each end of the rail |
| **Rain showers** | one wide round chrome rain shower head angled face up, on a short wall arm |
| **Push showers** | one small chrome push shower: a round wall plate with a central push button and a short angled spout |
| **Health faucets** | one chrome health faucet handset with a trigger lever, its braided hose coiled beside it and a small wall hook |
| **Angle valves** | three small chrome angle valves in a row, each an L-shaped body with a flat round handle on top |
| **Bottle traps** | one chrome bottle trap: a cylindrical body below a curved inlet arm, a round wall flange on the arm |
| **Basin wastes** | one chrome basin waste: a round slotted grating flange above a threaded tailpiece, its backnut and washer beside it |

## Plumbing accessories & hardware — 15

**Water heater / WC connectors** and **flexible hoses** are the pair to watch
here — both are braided hose, and without the different end fittings and
lengths below they come back as the same picture twice.

**PTFE tape is the single most likely to fail.** A roll of tape is the shape a
generator most wants to print a label on. Regenerate rather than accept one with
lettering; a fake brand on thread tape is still a fake brand.

| item | SUBJECT |
| --- | --- |
| **Towel rails** | one straight brushed stainless towel rail on two round wall flanges |
| **Towel racks** | one brushed stainless towel rack: a flat top shelf of parallel bars with a hanging rail below it, on two wall brackets |
| **Towel rings** | one brushed stainless towel ring, a closed round ring on a small square wall flange |
| **Soap cases** | one brushed stainless soap dish, a shallow slotted tray on a wall bracket |
| **Tissue holders** | one brushed stainless tissue holder with a spring roller and a plain white roll on it |
| **Tumbler holders** | one brushed stainless tumbler holder, a ring bracket with a plain clear glass tumbler sitting in it |
| **Coat hooks** | three brushed stainless coat hooks in a row, each a small round wall flange with a single upturned hook |
| **Glass shelves** | one clear glass bathroom shelf on two brushed stainless wall brackets |
| **Gratings** | three square stainless floor gratings of different sizes, one slotted, one with a round centre hole, one with a hinged flap |
| **PTFE / teflon tape** | three plain white rolls of thread tape on plain white cores, nothing printed on them, one roll with a short loose end |
| **Water heater / WC connectors** | a pair of short braided stainless flexible connectors with chrome nuts at both ends, a small chrome angle valve beside them |
| **Water tank connectors** | two plastic water tank connectors, a threaded barrel with a wide flange and a rubber washer, one assembled and one in its parts |
| **Float valves** | one brass float valve with a long arm and a round plastic ball float on the end |
| **Flexible hoses** | one long braided stainless flexible hose loosely coiled, chrome nuts at both ends |
| **Pipe brackets & clamps** | a group of plastic and metal pipe clamps in three sizes, saddle clamps and two-piece clamps, their screws beside them |

## Ceramic items — 6

**Low commodes** is written as a squat pan. Confirm that with the shop before
generating — see the note on `cat-ceramic.jpg` above.

| item | SUBJECT |
| --- | --- |
| **Wall-hung commodes** | one white ceramic wall-hung commode floating clear of the surface, its back flat for the wall, a plain seat lowered |
| **Floor-type commodes** | one white ceramic floor-standing commode with a close-coupled cistern and a plain lowered seat |
| **Low commodes** | one white ceramic squat pan set flat, oval, with moulded ribbed foot platforms either side and a plain rim |
| **Wall urinals** | one white ceramic wall-hung urinal, a tall rounded bowl with a flat back and a plain rim |
| **Floor urinals** | one tall white ceramic floor-standing urinal reaching the floor, a deep rounded bowl with a flat back |
| **Wash basins — all types** | three white ceramic basins together: a full-size pedestal basin, a round counter-top basin and a small compact cloakroom basin |

## Kitchen items — 8

**Smart sinks** is included here although section 2 says it cannot be drawn
distinctly. That was true of one item inside a crowded group shot. Alone on a
plate, a workstation sink with its stepped inner ledge is an unmistakable shape.

| item | SUBJECT |
| --- | --- |
| **Stainless steel sinks** | one brushed stainless steel double-bowl kitchen sink with a flat drainer to one side |
| **Fibre sinks** | one dark grey moulded fibre composite kitchen sink, a single deep bowl with a small drainer, matt granular surface |
| **Ceramic sinks** | one white ceramic kitchen sink, a single deep square bowl with a thick front apron |
| **Smart sinks** | one brushed stainless workstation sink: a single deep bowl with a stepped ledge inside the rim, a wooden chopping board and a stainless colander resting on that ledge |
| **Sink mixers — all types** | three chrome sink mixers together: one tall with a curved gooseneck spout, one with a pull-out spray head, one wall type with a long swivel spout |
| **Sink wastes** | one stainless basket strainer waste: a round slotted flange with a removable basket, its rubber washer and backnut beside it |
| **Stoves** | one stainless steel table-top gas stove with two burners, plain black burner caps and two round control knobs on the front |
| **Kitchen hoods** | one stainless steel chimney-style kitchen hood, a wide angled canopy narrowing into a vertical flue, a plain front |

## C-PVC pipes & fittings — 28

Written from the supplier catalogue page the client sent, so these describe what
ERA actually stocks rather than a generic C-PVC range: the pipe carries a red
identification stripe, the adhesive is the yellow C-PVC cement, and the brass
range is a real part of the line rather than an afterthought.

**The three brass entries are the ones worth getting right.** They are what a
plumber comes in for when C-PVC has to meet a geyser or a meter, and the bright
brass against cream plastic is what makes them readable at thumbnail size.

| item | SUBJECT |
| --- | --- |
| **Pipes** | three short lengths of cream-beige C-PVC pipe in different diameters lying together, each with a thin red identification stripe running along it, open ends toward the camera |
| **Sockets** | three plain cream C-PVC sockets in different diameters, short straight sleeves open at both ends |
| **Reducing sockets** | two cream C-PVC reducing sockets, each a short sleeve with one opening visibly wider than the other and a step between them |
| **Elbows 90°** | three cream C-PVC right-angle elbows in descending size, each with two plain socket openings |
| **Reducing elbows** | two cream C-PVC reducing elbows, each a right-angle bend with one opening visibly wider than the other |
| **Elbows 45°** | three cream C-PVC forty-five degree elbows in descending size, each a shallow bend with two plain socket openings |
| **Tees** | three cream C-PVC tees in descending size, each with three plain socket openings, the largest at the left |
| **Reducing tees** | two cream C-PVC reducing tees, each with three socket openings of which the branch is visibly smaller than the run |
| **Reducing bushes** | three cream C-PVC reducing bushes in different sizes, each a thick ring with a wide flange and a smaller bore through the middle |
| **Male adapters** | three cream C-PVC male adapters in different sizes, each a socket at one end and a plain external thread at the other |
| **Female adapters** | three cream C-PVC female adapters in different sizes, each a socket at one end and an internal thread at the other |
| **Brass female adapters** | three cream C-PVC female adapters with brass inserts, the bright brass internal thread set into the cream plastic body |
| **Brass male adapters** | three cream C-PVC male adapters with brass inserts, the bright brass external thread projecting from the cream plastic body |
| **Brass female elbows** | two cream C-PVC right-angle elbows, each with a brass female threaded insert in one opening and a plain socket in the other |
| **Brass female threaded tees** | two cream C-PVC tees, each with a brass female threaded insert in the branch and plain sockets on the run |
| **Brass male threaded tees** | two cream C-PVC tees, each with a brass male thread projecting from the branch and plain sockets on the run |
| **Brass male threaded elbows** | two cream C-PVC right-angle elbows, each with a brass male thread projecting from one opening and a plain socket in the other |
| **Unions** | two cream C-PVC unions in different sizes, each in three parts with a socket at either end and a large knurled ring nut in the middle |
| **Pipe clips** | three cream C-PVC pipe clips in different sizes, each a small open saddle with a screw hole at either side |
| **Step over bands** | two cream C-PVC step over bands, each a short pipe with a flattened offset loop in the middle that carries it over another pipe |
| **Threaded plugs** | three cream C-PVC threaded plugs, each an external thread below a solid hexagonal head |
| **End caps** | three plain cream C-PVC end caps in different diameters, each a short closed cup |
| **Ball valves** | two cream C-PVC ball valves in different sizes, each with a red lever handle across the body and a plain socket at either end |
| **Cross tees** | one cream C-PVC cross tee, four plain socket openings meeting at right angles in one plane |
| **Adhesive gum** | three small plain metal tins of yellow C-PVC pipe cement with nothing printed on them, one open with a brush standing in it |
| **Brass unions** | two unions, each with a cream C-PVC socket at one end and a large hexagonal brass body with a female thread at the other |
| **Tank adapters** | one cream C-PVC tank adapter, a long externally threaded barrel with a wide flange, its black rubber sealing washer lying loose beside it |
| **Pipe cutters** | one plastic pipe cutter with a red handle and a steel blade, its jaw open around a short length of cream C-PVC pipe |

## U-PVC pipes & fittings — 21

Four of these are not pictured on the catalogue page — cowls, pipe clips, tube
wells and vents — so they are written from the part rather than from a
photograph. Check those four against the shop before generating.

| item | SUBJECT |
| --- | --- |
| **Grey pipes** | three short lengths of grey U-PVC drainage pipe in different diameters lying together, plain and unmarked, open ends toward the camera |
| **White pipes** | three short lengths of white U-PVC drainage pipe in different diameters lying together, plain and unmarked, open ends toward the camera |
| **U-traps** | one white U-PVC U-trap, a deep U-shaped water seal with a plain socket at each end standing upright |
| **Long traps** | one white U-PVC long trap, a U-shaped seal with one leg drawn out into a long straight arm ending in a plain socket |
| **90° side door bends** | one white U-PVC ninety-degree bend with a bolted oval inspection door set in its flank rather than on the outer curve |
| **90° door bends** | one white U-PVC ninety-degree bend with a bolted round inspection door on the outer curve of the bend |
| **Plain cross tees** | one white U-PVC cross tee, four plain sockets meeting at right angles in one plane |
| **Plain tees** | two white U-PVC equal tees in different sizes, each with three plain sockets of the same diameter |
| **Door tees** | one white U-PVC tee with a bolted inspection door on the face of the branch, plain sockets on the run |
| **Inspection ports** | one white U-PVC inspection port, a short socket closed by a round bolted cover plate |
| **90° plain bends** | three white U-PVC ninety-degree bends in descending size, each with two plain sockets and no door |
| **Reducing tees** | two white U-PVC reducing tees, each with three sockets of which the branch is visibly smaller than the run |
| **Reducing Y-tees** | two white U-PVC Y-branches, each with an angled branch visibly smaller than the run |
| **S-traps** | one white U-PVC S-trap, a water seal whose outlet turns downward, with a plain socket at each end |
| **Side door tees** | one white U-PVC tee with a bolted inspection door on the side of the run, plain sockets elsewhere |
| **45° plain bends** | three white U-PVC forty-five degree bends in descending size, each a shallow bend with two plain sockets |
| **Cowls** | two white U-PVC vent cowls, each a short socket under a domed hood with open slots around the neck |
| **Pipe clips & clamps** | a group of white and grey U-PVC pipe clips in three sizes, saddle clamps and two-piece clamps, their screws beside them |
| **Solvent cement** | two plain metal tins of solvent cement with nothing printed on them, one open with a brush standing in it |
| **Tube wells** | two lengths of U-PVC tube-well pipe standing upright, one plain casing and one slotted screen with narrow horizontal slits cut along it |
| **Vents** | one white U-PVC vent fitting, a short straight pipe with a ventilated collar of open slots near the top |

## Pressure PVC-U — 16

**The colour question is settled.** It used to say grey here, to match the
`cat-pressure.jpg` that was on the site. The client's own sixteen photographs
came back **white**, so white is what the shop stocks and white is what these
say. `cat-pressure.jpg` is the one now out of step and is being regenerated;
until it is, the category photograph shows a dark grey and blue range that
matches nothing beneath it.

**And one thing to confirm with the shop.** The supplier's list sells a
*female socket*, a *coupling*, a *reducing coupling* and a *brass female
coupling* as four separate lines. In most pressure ranges a socket and a
coupling are the same part under two names. They are written here as four,
because that is how the catalogue sells them — but if the shop hands a
customer the same box for two of these, two cards should be merged.

| item | SUBJECT |
| --- | --- |
| **Pipes** | three short lengths of thick-walled white pressure PVC-U pipe in different diameters lying together, walls visibly heavier than drainage pipe |
| **Male adapters** | three white pressure PVC-U male adapters in descending size, each a socket at one end and an external thread at the other |
| **Reducing tees** | one white pressure PVC-U reducing tee, thick-walled, its branch socket visibly narrower than its run |
| **Brass female threaded tees** | one white pressure PVC-U tee with a brass female thread set into its branch socket, the brass bright against the grey |
| **Female sockets** | three white pressure PVC-U female sockets in different diameters, short thick-walled sleeves threaded on the inside |
| **Unions** | one white pressure PVC-U union in three parts, two socket halves and the knurled ring nut that draws them together |
| **Brass female elbows** | one white pressure PVC-U right-angle elbow with a brass female thread in one opening |
| **Elbows 90°** | three plain white pressure PVC-U right-angle elbows in descending size, each with two plain sockets |
| **Plain tees** | three plain white pressure PVC-U tees in descending size, each thick-walled with three equal sockets |
| **Brass female couplings** | two white pressure PVC-U couplings, each with a brass female thread set into one end |
| **Couplings** | three plain white pressure PVC-U couplings in different diameters, short straight sleeves open and plain at both ends |
| **Reducing couplings** | two white pressure PVC-U reducing couplings, each stepping from a wide socket down to a narrower one |
| **Solvent cement** | three plain metal tins of pressure solvent cement with nothing printed on them, one open with a brush standing in it |
| **End caps** | three plain white pressure PVC-U end caps in different diameters, each a thick closed cup |
| **Pressure reducing valves** | one brass pressure reducing valve with a domed adjusting cap on top and a round pressure gauge on its side |
| **Ball valves** | two white pressure PVC-U ball valves with plain lever handles, one handle in line with the body and one across it |

## What is deliberately absent

| left out | why |
| --- | --- |
| `etc.` ×7 | not an item |
| Kitchen accessories | a catch-all — whatever it draws becomes a claim about specific stock |

That is **81 of the 82 items**, every category covered. The seven category
photographs in section 2 are unchanged: these are the items inside them.

## If you switch tools

These prompts are plain description, so they work in Flux, Gemini/Nano Banana
and Ideogram as they are. For Midjourney, drop the first line and append:

```
--ar 16:9 --style raw --no text, lettering, logo, watermark, brand, label
```

Midjourney does have a real negative field, so there the exclusions can be
stated directly instead of as "plain, unmarked surfaces".

## What to replace first

As real photographs arrive, overwrite the generated ones — same filename, run
`add-photos.py` again, done. Priority order, by how much each one earns:

1. The three shop photographs. Nothing generated substitutes for them.
2. `trade-plumbing` and `trade-core-cutting` — the two trades customers ask
   about most, and the easiest to photograph on a live job.
3. The remaining trades, as jobs come up. Photograph the finished work, not the
   mess in the middle.
4. The categories last. A clean generated product group is genuinely fine here,
   and a phone photo of a dim shelf is worse.
