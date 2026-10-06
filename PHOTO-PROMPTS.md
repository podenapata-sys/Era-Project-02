# Photographs: what to shoot, what to generate, and the prompts

Twenty-one images cover the whole site. Every one of them is a dashed
placeholder today — nine on the home page alone, a quarter of the page on a
phone. This file gets them filled.

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

## The rules that apply to all of them

**Always ask ChatGPT for a landscape image.** This is the single most important
line in this file. ChatGPT gives you 1792×1024 (landscape), 1024×1024 (square)
or 1024×1792 (portrait). Each source here gets cropped to *two different shapes*
by the tool, and only landscape is large enough to survive both:

| | what it is cropped to | 1792×1024 landscape | 1024×1024 square |
| --- | --- | --- | --- |
| a category | 16:9 and 4:3 | fine | too small, blurs |
| a trade | 4:3 and 16:10 | fine | too small, blurs |

**Leave empty margin around the subject.** The same frame becomes a wide strip
*and* a near-square. Anything close to an edge gets cut off. Every prompt below
already says this; do not delete that sentence when you edit one.

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

### `cat-cpvc.jpg` — C-PVC pipes & fittings (1/2"–6")

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A catalogue photograph of cream-coloured C-PVC plumbing parts laid out on a plain mid-grey seamless studio background: three short lengths of cream pipe in different diameters, plus 90-degree and 45-degree elbows, tees, sockets, reducers, a union and a small brass-handled ball valve, arranged in a loose group with space between the pieces. Every surface is plain, smooth and unmarked. Soft even overhead light, gentle contact shadows. Camera straight on at tabletop height. The whole group sits in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Sharp focus throughout, clean and simple, nothing else in the scene.

### `cat-upvc.jpg` — U-PVC pipes & fittings (1.25"–12")

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A catalogue photograph of white U-PVC soil and drainage parts on a plain mid-grey seamless studio background: two or three wide white drainage pipes of different diameters, a long-radius bend, a Y-tee, a P-trap, a pipe clip and a vent cowl, arranged in a loose group with clear space between the pieces. Every surface is plain, smooth, unmarked white plastic. Soft even overhead light, gentle contact shadows. Camera straight on at tabletop height. The whole group sits in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Sharp focus throughout, clean and simple, nothing else in the scene.

### `cat-pressure.jpg` — Pressure PVC-U (1/2"–4")

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A catalogue photograph of grey pressure PVC-U plumbing parts on a plain mid-grey seamless studio background, slightly lighter than the parts so they stand out: two thick-walled grey pressure pipes of different diameters, sockets, elbows, tees, an end cap, a flange adapter and a threaded adapter, arranged in a loose group with space between the pieces. Every surface is plain, smooth and unmarked. Soft even overhead light, gentle contact shadows. Camera straight on at tabletop height. The whole group sits in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Sharp focus throughout, clean and simple, nothing else in the scene.

### `cat-bathroom-fittings.jpg` — Bathroom fittings (brass & CP finish)

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A catalogue photograph of polished chrome bathroom taps and mixers on a plain mid-grey seamless studio background: a basin mixer, a bath mixer, a long-body tap, a bib cock, a round rain shower head, a flexible shower set and a small angle valve, standing upright and evenly spaced with clear space between them. Every surface is plain polished chrome, smooth and unmarked. Soft diffused studio light from above and both sides so the chrome reads as bright metal rather than a mirror, gentle contact shadows. Camera straight on at product height. The whole group sits in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Sharp focus throughout, clean and simple, nothing else in the scene.

### `cat-accessories.jpg` — Plumbing accessories & hardware

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A catalogue photograph of small bathroom hardware and plumbing fittings on a plain mid-grey seamless studio background: a stainless steel towel rail, a towel ring, a soap dish, a tissue holder, a square floor grating, a white roll of plain PTFE thread tape, a braided flexible hose, a brass float valve and two pipe clamps, arranged in a loose group with clear space between the pieces. Every surface is plain brushed steel, brass or white plastic, smooth and unmarked. Soft even overhead light, gentle contact shadows. Camera straight on at tabletop height. The whole group sits in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Sharp focus throughout, clean and simple, nothing else in the scene.

### `cat-ceramic.jpg` — Ceramic items

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A catalogue photograph of white ceramic sanitaryware arranged on a plain mid-grey seamless studio background: one wall-hung commode, one floor-mounted commode, a wall-mounted urinal and two wash basins of different shapes, evenly spaced with clear space between them. Every surface is plain, smooth, unmarked white ceramic. Soft even overhead light, gentle contact shadows, slightly warm tone. Camera straight on at product height. The whole group sits in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Sharp focus throughout, clean and simple, nothing else in the scene.

### `cat-kitchen.jpg` — Kitchen items

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A catalogue photograph of kitchen fittings on a plain mid-grey seamless studio background: a double-bowl stainless steel sink, a single-bowl sink, a tall chrome sink mixer with a curved spout, a basket strainer waste and a stainless steel gas stove with two burners, arranged with clear space between them. Every surface is plain brushed or polished stainless steel, smooth and unmarked, with plain black burner caps. Soft diffused light from above and both sides, gentle contact shadows. Camera straight on at counter height. The whole group sits in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Sharp focus throughout, clean and simple, nothing else in the scene.

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

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A documentary photograph of plumbing work in progress inside an unfinished concrete apartment in Dhaka, Bangladesh. Close on a pair of working hands tightening a fitting on a run of cream C-PVC pipe clipped to a bare plaster wall; a pipe wrench and a coil of thread tape rest on the floor nearby. Daylight from an open window, warm and slightly dusty, natural shadows. The hands and the pipe junction sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked pipe and tools. Realistic, sharp, no faces in the picture.

### `trade-tiles-marble-granite.jpg` — Tiles, marble & granite work

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A documentary photograph of floor tiling in progress in an unfinished room in Dhaka, Bangladesh. Close on working hands lowering a large polished tile into fresh adhesive, a notched trowel and tile spacers beside them, a straight line of already-laid tiles running away to one side. Daylight from a window, warm natural tone, fine dust in the air. The hands and the tile sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked tiles and tools. Realistic, sharp, no faces in the picture.

### `trade-core-cutting.jpg` — Core cutting work

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A documentary photograph of concrete core drilling in an unfinished building in Dhaka, Bangladesh. A core drilling rig bolted to a bare concrete wall, its cylindrical diamond core bit part-way through, a clean circular hole already cut beside it with the concrete core lying on the floor, water running down the wall from the cut. Gloved hands on the rig handle. Daylight, grey concrete, wet surfaces catching the light. The drill head and the cut hole sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked equipment. Realistic, sharp, no faces in the picture.

### `trade-deep-tube-well.jpg` — Deep tube well work

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A documentary photograph of tube well boring on an open building site in Dhaka, Bangladesh. A vertical drilling mast over a bore hole, lengths of steel casing pipe stacked on the ground, muddy water pooled around the hole, a submersible pump and coiled discharge pipe waiting to one side. Working hands guiding a casing pipe into the bore. Bright overcast daylight, wet earth, plain steel. The bore hole and the casing sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked equipment. Realistic, sharp, no faces in the picture.

### `trade-swimming-pool.jpg` — Swimming pool work

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A documentary photograph of swimming pool plumbing under construction in Dhaka, Bangladesh. An empty concrete pool shell with white PVC circulation pipes running along the floor and up the wall to inlet fittings, a filter housing and valve manifold standing at the poolside, working hands fitting a union onto the manifold. Bright daylight, grey concrete, clean white pipe. The valve manifold sits in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked pipe and equipment. Realistic, sharp, no faces in the picture.

### `trade-damp-proofing.jpg` — Damp proofing work

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A documentary photograph of damp proofing work on a ground-floor wall in Dhaka, Bangladesh. Close on working hands brushing a thick dark bituminous damp-proof coating onto bare brickwork at floor level, the treated section visibly darker than the untreated brick beside it, a bucket of coating and a wide brush on the floor. Daylight from one side, raking across the wall to show texture. The brush and the edge between treated and untreated wall sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked tools and containers. Realistic, sharp, no faces in the picture.

### `trade-water-proofing.jpg` — Water proofing work

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A documentary photograph of roof waterproofing in progress in Dhaka, Bangladesh. Working hands rolling a grey cementitious waterproof membrane onto a flat concrete roof slab, the coated area a clearly different shade from the bare concrete, a roller tray and a parapet upstand already coated behind. Strong daylight, flat concrete, long shadows. The roller and the coating edge sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked tools and containers. Realistic, sharp, no faces in the picture.

### `trade-electric.jpg` — Electric work

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A documentary photograph of electrical work in an unfinished apartment in Dhaka, Bangladesh. Close on working hands terminating coloured wires into a wall-mounted consumer unit with a neat row of plain circuit breakers, conduit running up the bare plaster wall, a screwdriver and a wire stripper resting on the board. Daylight from a window, cool neutral tone. The consumer unit and the hands sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked breakers and tools, no writing on anything. Realistic, sharp, no faces in the picture.

### `trade-painting.jpg` — Painting work

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A documentary photograph of interior painting in progress in Dhaka, Bangladesh. Close on working hands rolling pale paint onto a prepared interior wall, a crisp wet edge between the fresh coat and the duller putty-filled surface beside it, a roller tray and a putty knife on a dust sheet below. Soft daylight from a window, clean and bright. The roller and the wet edge sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked tins and tools. Realistic, sharp, no faces in the picture.

### `trade-thai-glass.jpg` — Thai Glass work

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A documentary photograph of glass partition installation in Dhaka, Bangladesh. Two pairs of gloved hands guiding a large clear glass panel into a slim aluminium frame, suction cup handles gripping the glass, a finished glass partition visible behind. Bright daylight through the glass, clean reflections, pale aluminium. The panel edge and the frame channel sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked glass and framing. Realistic, sharp, no faces in the picture.

### `trade-civil.jpg` — Civil work

> Use this prompt exactly as written; do not rewrite or embellish it. Generate a landscape (1792×1024) image.
>
> A documentary photograph of brickwork and plastering in Dhaka, Bangladesh. Close on working hands laying a red clay brick into a fresh mortar bed on a rising wall, a trowel and a spirit level in frame, a half-plastered section of the same wall behind showing the smooth grey finish over the brick. Warm daylight, dusty air, red brick against grey mortar. The hands and the brick course sit in the middle of the frame with generous empty margin on all four sides, so it can be cropped to a wide strip or a square without cutting anything off. Plain unmarked tools. Realistic, sharp, no faces in the picture.

---

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
