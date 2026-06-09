# Yuzu Facebook Stories Mixed Daily Pack Design

Date: 2026-06-09

Status: approved direction, awaiting implementation plan

## Purpose

Create a high-visual Facebook Stories system for Yuzu Cigar Club that can publish 5 to 10 vertical Story frames per day for 28 days. The selected direction is the high-volume `Mixed Daily Pack`, which tells one coherent daily story through luxury collage, education, product-detail storytelling, and community prompts.

This design builds on:

- `docs/yuzu-facebook-first-month-post-schedule-2026-06-09.csv`
- `docs/yuzu-facebook-stories-posting-schedule-2026-06-09.csv`
- `docs/yuzu-facebook-stories-meta-planner-runbook-2026-06-08.md`
- `docs/yuzu-luxury-social-creative-standard-2026-06-08.md`
- Visual preview: `http://localhost:56320`

## Selected Direction

The user reviewed three on-screen systems and approved option C: `Mixed Daily Pack`.

The daily pack has ten possible Story frames:

1. Scene opener
2. Daily hook
3. Visual collage
4. Teaching cue
5. Common mistake or reset
6. Object story
7. Community poll
8. Note card
9. Soft brand close
10. Reply / 21+ compliance close

On lighter days, the system trims to five frames while preserving the arc:

1. Scene opener
2. Visual collage
3. Teaching cue
4. Poll or question
5. Reply / 21+ compliance close

## Experience Goals

- Make Stories feel like a luxury cigar magazine sequence rather than isolated prompt cards.
- Use collages of real or photorealistic images to tell the story visually.
- Keep text large, sparse, and readable on mobile.
- Rotate education, lounge culture, product-detail storytelling, humidor notes, and Cigar Flow editorial.
- Support 28 days of output without making every day feel template-stamped.
- Preserve adult 21+ compliance and avoid marketplace framing.

## Daily Story Structure

### Frame 1: Scene Opener

Purpose: set the mood before the topic appears.

Visual: lounge table, humidor drawer, ashtray, cigar rest, wrapper leaf, journal, cutter, glassware, or patio table.

Copy style: one short atmospheric line, not an explanation.

### Frame 2: Daily Hook

Purpose: introduce the day's topic from the schedule.

Visual: single strong image with clean negative space.

Copy style: 4 to 7 word headline plus a short subline.

### Frame 3: Visual Collage

Purpose: make the Story feel rich and high-visual.

Visual: three-image collage with a hero detail, a close crop, and a supporting object. Use editorial photography or photorealistic generated sources with no readable labels.

Copy style: one observation or contrast.

### Frame 4: Teaching Cue

Purpose: give one practical instruction.

Visual: close-up of the object or action being taught.

Copy style: one action sentence, no dense bullets.

### Frame 5: Common Mistake Or Reset

Purpose: add usefulness and reduce beginner friction.

Visual: the correction moment, such as moving over the tray, checking the burn, slowing the light, or logging a note.

Copy style: name the mistake and the reset.

### Frame 6: Object Story

Purpose: add product or culture depth without sales language.

Visual: cigar, packaging, band detail, maker context, humidor object, journal note, or Cigar Flow editorial card.

Copy style: maker, size, wrapper, origin, profile vocabulary, packaging detail, or editorial context. Avoid pricing, inventory, ordering, discounts, and availability language.

### Frame 7: Community Poll

Purpose: invite interaction.

Visual: simple poll card over a luxury photo with clear sticker-safe space.

Copy style: one question with 2 to 4 answer choices.

### Frame 8: Note Card

Purpose: create a saveable recap.

Visual: journal or card-style panel over photo, with only the most useful takeaway.

Copy style: one screenshot-worthy note.

### Frame 9: Soft Brand Close

Purpose: keep Yuzu present without turning the Story into an ad.

Visual: small Yuzu mark, refined texture, and one brand line.

Copy style: education, notes, community, or Cigar Flow positioning.

### Frame 10: Reply / Compliance Close

Purpose: end with a reply prompt and compliance footer.

Visual: strong final image or collage with sticker-safe space.

Copy style: direct reply prompt plus `21+ only` and no marketplace framing.

## Calendar Mapping

The existing 2026-06-09 through 2026-07-08 Story schedule remains the source of topics and timing. Implementation should group each day's scheduled rows into one daily pack:

- Morning education row feeds frames 2 through 5.
- Evening interactive row feeds frames 7 and 10.
- Existing video/trend rows can replace frame 6 or become an extra frame after frame 8 when the audio gate passes.
- Page post topics from `docs/yuzu-facebook-first-month-post-schedule-2026-06-09.csv` provide deeper detail for education days.

The final production plan should generate one folder per day with 5 to 10 `1080x1920` Story assets, a manifest, a contact sheet, and posting notes for Meta Planner.

## Visual System

Use the Yuzu luxury material palette: champagne, ivory, brass, walnut, black leather, cedar, oxblood, and deep green.

Rules:

- Use full-bleed editorial photography or photorealistic generated images.
- Prefer real product or source images when available.
- Avoid clipart, cartoon assets, dense icons, heavy black rectangles, stock-photo blur, and overly dark murk.
- Keep the strongest object in the first visual second or top half of still frames.
- Use collage frames to show multiple related details, not random decoration.
- Keep text blocks inside safe margins for mobile Stories.
- Leave sticker-safe space on poll and reply frames.
- Keep the Yuzu mark small and restrained.

## Compliance

Every public Story package must stay within these guardrails:

- Adult `21+ only` framing.
- No buying, selling, trading, pricing, inventory, order, discount, giveaway, free sample, or availability language.
- No health, safer, therapeutic, stress-treatment, low-risk, modified-risk, or cessation claims.
- No minors or youth-oriented visuals.
- Product-detail frames are editorial or educational, not sales CTAs.
- Video or audio assets require clean original or licensed audio and audio verification before scheduling.

## Production Outputs

For each daily package:

- `story-01-scene-opener.jpg`
- `story-02-daily-hook.jpg`
- `story-03-visual-collage.jpg`
- `story-04-teaching-cue.jpg`
- `story-05-reset.jpg`
- `story-06-object-story.jpg` when the day supports it
- `story-07-community-poll.jpg`
- `story-08-note-card.jpg` when the day supports it
- `story-09-soft-brand-close.jpg` when the day supports it
- `story-10-reply-21-plus-close.jpg`
- `contact-sheet.jpg`
- `manifest.json`
- `posting-notes.md`

Daily packages may intentionally ship as 5, 7, 8, or 10 frames depending on available source imagery and the importance of the day.

## Verification

Before any Story package is marked ready:

- Check every asset is `1080x1920`.
- Check images are nonblank and use forward-facing visual hierarchy.
- Visually inspect the contact sheet for text overlap, cramped panels, dark unreadable sections, and sticker-safe space.
- Confirm captions and visible text include adult framing where appropriate.
- Scan text for prohibited marketplace, price, inventory, giveaway, and health-claim language.
- For video rows, verify audio quality before scheduling.
- Update `docs/codex-worktree-tracking.md` with assets generated, verification results, and remaining dirty-worktree notes.

## Non-Goals

- Do not publish or schedule Stories during the design/spec phase.
- Do not depend on Instagram while the Instagram page is disabled.
- Do not create sales-forward product ads.
- Do not generate all 280 possible maximum frames if a lower daily count tells the story better.

## Implementation Approach

Implementation should start with a pilot week package covering the first seven unscheduled or refreshable Story days, then scale the same renderer and manifest format across the remaining 21 days after visual QA passes. This keeps the full 28-day goal intact while letting the first contact sheets set the production standard before hundreds of frames are generated.

## Acceptance Criteria

- A production pass can generate 5 to 10 Story frames for each day from 2026-06-09 through 2026-07-08.
- Each generated day has a coherent sequence rather than isolated cards.
- Each day has a contact sheet and manifest for review.
- The asset package is compatible with Meta Planner manual scheduling.
- The verification checklist catches unreadable text, bad crops, missing adult framing, and prohibited language before publishing.
