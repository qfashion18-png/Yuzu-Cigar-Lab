# Storyboard

**Format:** 1920x1080
**Audio:** Kokoro voiceover + understated premium lounge underscore direction
**VO direction:** Confident, warm, restrained product-promo delivery. Calm private-club register; short pauses between lines.
**Style basis:** DESIGN.md, using captured Yuzu colors, Georgia display type, Inter interface labels, cigar box photography, and gold rule-line UI.

**Global guardrails**

- Every beat uses cigar/product or humidor UI assets; no text-only scenes.
- Keep the canvas dark and warm: `#030504`, `#07110D`, `#101812`, cream text, gold linework.
- Use Georgia for emotional brand statements and Inter for proof, labels, stats, and CTA details.
- Maintain premium restraint, but keep the frame alive with Ken Burns motion, drawn gold paths, counters, parallax panels, and subtle grain.
- Transitions are luxe focus pulls and velocity-matched pushes; no jump cuts.
- Add a persistent host presenter tile in the top-right corner. The host speaks the VO through beat-specific cue text, subtle mouth motion, and gold voice-meter bars while staying secondary to the website visuals.

**Underscore direction:** Minimal lounge-electronic bed with soft upright-bass pulse, brushed percussion, and warm vinyl texture. Low enough for VO clarity. Small chime hits when stats lock in, warm shutter for product card reveals, low whoosh for transitions.

## Asset Audit

| Asset | Type | Assign to Beat | Role |
| --- | --- | --- | --- |
| `capture/assets/site/yuzu-logo.png` | Logo | Beat 1, Beat 5 | Brand opener and closer |
| `capture/assets/site/yuzu-icon.svg` | Logo SVG | Beat 4 | Small compliance/member icon accents |
| `capture/assets/site/hero-boxes.png` | Hero image | Beat 1 | Full-bleed cigar box table, slow push-in |
| `capture/assets/site/membership-boxes.png` | Hero image | Beat 2 | Membership packaging and lounge product proof |
| `capture/assets/site/shop-hero.png` | Product photo | Beat 2 | Featured box close-up, layered behind cards |
| `capture/assets/site/product-padron.png` | Product crop | Beat 2 | Product card fan |
| `capture/assets/site/product-davidoff.png` | Product crop | Beat 2 | Product card fan |
| `capture/assets/site/product-liga.png` | Product crop | Beat 2 | Product card fan |
| `capture/assets/site/product-fuente.png` | Product crop | Beat 2 | Product card fan |
| `capture/assets/site/product-plasencia.png` | Product crop | Beat 2 | Product card fan |
| `capture/assets/site/mobile-layout.png` | App screenshot | Beat 3 | Digital humidor/app feature collage |
| `capture/assets/site/humidor.png` | App screenshot | Beat 3 | Humidor tracking UI panel |
| `capture/assets/site/journal.png` | App screenshot | Beat 3 | Tasting notes/history panel |
| `capture/assets/site/membership.png` | Page screenshot | Beat 4 | Membership tiers proof panel |
| `capture/assets/site/checkout.png` | Page screenshot | Beat 4 | Compliance checkout proof panel |
| `capture/assets/site/frontpage.png` | Page screenshot | Beat 5 | Faint closing background collage |
| `capture/assets/svgs/lucide-package.svg` | Icon | Beat 1, Beat 2 | Box-only and shop CTA accent |
| `capture/assets/svgs/lucide-droplets.svg` | Icon | Beat 3 | Humidity stat accent |
| `capture/assets/svgs/lucide-shield-check.svg` | Icon | Beat 4 | Compliance proof accent |
| `capture/assets/svgs/lucide-calendar-days.svg` | Icon | Beat 4 | Events/private drops accent |

## Beat 1 - Box-Worthy Hook (0.00-2.70s)

**VO cue:** "Premium cigars shouldn't feel transactional."

**Concept:** The viewer opens inside a private humidor lounge, already close to the cigar boxes. The line lands as a contrast: this is not a commodity grid; it is a curated, member-grade ritual. The frame should feel tactile: wood, paper labels, brass-gold UI traces, and one crisp Yuzu mark.

**Visual description:** `hero-boxes.png` fills the frame with a slow push-in. A translucent deep-green panel slides in from the left, carrying the Yuzu logo and a large Georgia statement: "Not a transaction. A collection." Gold linework draws around the hero image like a product inspection frame. Three humidor stat chips count in: 69% humidity, 70 F temp, 5 boxes aging. Tiny package and lock icons drift in the foreground.

**Mood direction:** Premium cinematic lounge, warm but disciplined. Think luxury editorial opener with product UI precision.

**Assets:** `hero-boxes.png` full-bleed; `yuzu-logo.png` top-left; `lucide-package.svg` and `lucide-lock-keyhole.svg` as small gold utility accents.

**Techniques:** Ken Burns image movement, SVG path drawing, counter animation, per-word kinetic typography.

**Animation choreography:** Photo PUSHES forward slowly; logo GLOWS in; headline WORDS RISE one by one; gold frame DRAWS around the product; stats COUNT UP and LOCK with a small chime; icons FLOAT 6px in alternating directions.

**Transition:** Luxe focus pull into Beat 2: outgoing image blurs 18px and scales 1.03 over 0.55s; Beat 2 clears from blur and slight rightward drift.

**Depth layers:** BG: hero photo + warm vignette. MG: translucent statement panel and stat chips. FG: gold rule lines, floating icons, fine grain.

**SFX cues:** Soft lighter click at first word. Low warm chime when "transactional" resolves.

## Beat 2 - Box Commerce, Member Value (2.70-7.85s)

**VO cue:** "Yuzu sells by the box, curates member pricing, and keeps your collection in view."

**Concept:** The scene becomes a moving product wall. Boxes rotate into place like a collector opening trays, while member pricing and box-only logic snap onto each card. This beat proves the storefront is not singles-and-scroll; it is a disciplined buying model.

**Visual description:** `membership-boxes.png` creates an amber lounge background. Five product crops form a staggered 3D fan across the lower half, each inside a bordered Yuzu card with product name, box count, and price. Above them, three gold proof labels appear: Box only, Member pricing, Curated quality. On the right, a compact member tier strip slides in showing Kisha, Sensei, Daimyo.

**Mood direction:** Elegant product launch wall, like a premium catalog coming alive.

**Assets:** `membership-boxes.png`, `shop-hero.png`, `product-padron.png`, `product-davidoff.png`, `product-liga.png`, `product-fuente.png`, `product-plasencia.png`, `lucide-package.svg`.

**Techniques:** CSS 3D transforms, product-card parallax, SVG rule drawing, staggered card choreography.

**Animation choreography:** Background DRIFTS left; product cards CASCADE up with slight `rotationY`; gold borders DRAW around each card; prices COUNT in; tier strip SLIDES from right and SETTLES; proof labels STAMP in with tiny gold flashes.

**Transition:** Velocity-matched push upward into Beat 3: content continues upward 120px with 14px blur over 0.38s; Beat 3 enters from below and clears blur.

**Depth layers:** BG: lounge box photo. MG: product card fan and tier strip. FG: proof labels, gold price numerals, small line sparks.

**SFX cues:** Warm shutter ticks for each card; muted register bell when member pricing locks.

## Beat 3 - Smart Humidor System (7.85-12.90s)

**VO cue:** "Shop rare releases. Track humidity, aging windows, tasting notes, and reorders."

**Concept:** The luxury product wall becomes an operational cellar interface. The viewer sees the collection as data: humidity, aging, tasting history, and reorder timing moving through one coherent dashboard.

**Visual description:** A large tilted phone/app stack uses `mobile-layout.png`, `humidor.png`, and `journal.png` as layered panels. A gold data path connects feature nodes: Rare releases, Humidity, Aging windows, Tasting notes, Reorders. The 69% and 70 F values count in large tabular numerals while a small timeline fills across the bottom.

**Mood direction:** Premium cellar meets polished PWA dashboard. Useful, controlled, and quietly high-tech.

**Assets:** `mobile-layout.png`, `humidor.png`, `journal.png`, `lucide-droplets.svg`, `lucide-thermometer.svg`, `lucide-gauge.svg`, `lucide-heart.svg`.

**Techniques:** CSS 3D panel stack, SVG path drawing, counter animation, character-by-character feature labels.

**Animation choreography:** Screenshot panels FAN open in 3D; feature nodes DOT along a drawn path; stats COUNT UP; timeline FILLS left-to-right; labels TYPE ON in short bursts; panel stack FLOATS subtly for the whole beat.

**Transition:** Blur crossfade with warm gold light leak into Beat 4 over 0.6s.

**Depth layers:** BG: dark forest surface with faint oversized "HUMIDOR" ghost text. MG: 3D app panels and connected feature path. FG: counters, labels, gold line particles.

**SFX cues:** Quiet digital tick for each typed feature; soft humidity-meter beep when 69% appears.

## Beat 4 - Membership and Compliance Proof (12.90-17.60s)

**VO cue:** "Membership unlocks private drops, events, concierge guidance, and compliant adult-signature checkout."

**Concept:** The pitch widens from collection management to club infrastructure. Membership benefits and compliance proof should feel like premium access with operational trust underneath.

**Visual description:** `membership.png` slides in as a tall framed panel on the left. `checkout.png` slides in as a smaller proof panel on the right. Between them, gold benefit tiles flip on: Private drops, Events, Concierge, Adult-signature. A shield-check icon expands into a fine-line compliance stamp. A small row of roadmap cards appears beneath: age verification, shipping rules, audit events.

**Mood direction:** Private club credentialing, not bureaucratic compliance. Secure, premium, and matter-of-fact.

**Assets:** `membership.png`, `checkout.png`, `yuzu-icon.svg`, `lucide-shield-check.svg`, `lucide-calendar-days.svg`, `lucide-truck.svg`, `lucide-lock-keyhole.svg`.

**Techniques:** 3D card flip, SVG badge drawing, staggered blocks transition, counter-style checklist reveal.

**Animation choreography:** Membership panel GLIDES in; checkout panel TILTS into frame; benefit tiles FLIP on sequentially; shield badge DRAWS itself; roadmap cards RISE and SNAP to grid; adult-signature label HIGHLIGHTS with a gold sweep.

**Transition:** Slow color dip to black-green, then logo reveal into Beat 5 over 0.65s.

**Depth layers:** BG: dark surface and faint membership screenshot. MG: two proof panels and benefit tile row. FG: drawn compliance stamp and gold highlight sweep.

**SFX cues:** Low access-card tap on "unlocks"; soft seal stamp on "checkout."

## Beat 5 - Brand Close (17.60-20.00s)

**VO cue:** "Yuzu Cigar Club. Build your box-worthy cellar."

**Concept:** The final beat resolves into the brand mark and a compact offer. The product promise is now simple: a premium cigar cellar you can shop, join, and manage.

**Visual description:** The frame dips to `#030504`, then the Yuzu logo assembles at center over a faint collage of `frontpage.png`, product boxes, and gold grid lines. The final line appears in Georgia: "Build your box-worthy cellar." A gold CTA bar underneath reads "Shop Boxes | Join Now | Explore Humidor." The logo and CTA hold long enough to read, then fade to the dark Yuzu background.

**Mood direction:** Premium brand-card close, calm confidence, no hype clutter.

**Assets:** `yuzu-logo.png`, `frontpage.png`, `product-padron.png`, `product-davidoff.png`, `product-liga.png`.

**Techniques:** Logo assembly, per-word typography, soft parallax collage, final fade.

**Animation choreography:** Background collage DRIFTS slowly at 8% opacity; logo BUILDS from scale and glow; title WORDS RISE; CTA bar DRAWS left-to-right; gold accents BREATHE once; final scene FADES gently to near-black.

**Transition:** Final fade only, allowed on last scene: logo and CTA fade to 0 over final 0.45s.

**Depth layers:** BG: faint page/product collage and dark green wash. MG: centered logo and headline. FG: CTA bar and gold hairline frame.

**SFX cues:** Warm final chord, small brass chime as logo lands.

## Production Architecture

```text
yuzu-product-promo/
|-- index.html              single-file root composition with all five beats
|-- DESIGN.md
|-- SCRIPT.md
|-- STORYBOARD.md
|-- narration.txt
|-- narration.wav
|-- transcript.json
|-- capture/
|   |-- screenshots/
|   |-- assets/
|   |   |-- site/
|   |   `-- svgs/
|   `-- extracted/
`-- snapshots/
    |-- frame-00-at-2.1s.png
    |-- frame-01-at-5.3s.png
    |-- frame-02-at-10.4s.png
    |-- frame-03-at-15.2s.png
    `-- frame-04-at-19.1s.png
```
