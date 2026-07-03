# Cigar Flow HeyGen Influencer Video Brief

Date: 2026-06-25

Goal: turn Cigar Flow into recurring short-form influencer-style videos with a consistent HeyGen concierge avatar, premium cigar-culture backgrounds, on-screen text, captions, and platform-safe copy.

## Research Summary

Public platform data is uneven: TikTok and Instagram do not reliably expose a sortable "highest viewed cigar videos" surface through the open web. The strongest available signals came from visible high-view YouTube Shorts, social platform creative guidance, Meta/TikTok/YouTube policy pages, and current cigar-industry guidance.

High-view cigar-adjacent patterns found:

- Celebrity or status proximity: a Dana White cigar gift/unboxing Short surfaced with about 1.8M views.
- Gadget curiosity: a cigar/smoke gadget Short surfaced around 1.6M views, and torch lighter/rolling machine Shorts surfaced around 1.9M to 2.3M views.
- Process fascination: rolling, cutting, lighting, ash, humidor, and machinery work because the viewer understands the action before hearing the narration.
- Lounge discovery: venue walkthroughs with a clear promise perform better than product-only shots.
- Expert explainer posture: short "you are thinking about this wrong" education hooks fit the 2026 short-form advice around authority, curiosity, and watch time.
- Caption-first construction: TikTok's own creative guidance says the hook belongs in the first few seconds and recommends text overlays for context.

Useful sources:

- TikTok creative best practices: https://ads.tiktok.com/help/article/creative-best-practices
- TikTok Creative Center: https://ads.tiktok.com/creative/creativeCenter
- TikTok tobacco/nicotine ad policy: https://ads.tiktok.com/help/article/tiktok-ads-policy-dangerous-products-or-services
- TikTok branded content market requirements: https://ads.tiktok.com/help/article/branded-content-policy-country-specific-requirements
- Meta advertising standards: https://transparency.meta.com/policies/ad-standards/
- PCA guidance on Facebook/Instagram cigar content: https://premiumcigars.org/facebook-and-instagram-are-restricting-cigar-content-guidance-for-retailers/
- YouTube advertiser-friendly tobacco guidance: https://support.google.com/youtube/answer/6162278?hl=en
- YouTube regulated goods policy: https://support.google.com/youtube/answer/9229611?hl=en

## Platform Guardrails

The videos should be built as organic editorial and educational content, not paid tobacco promotion.

Default rules:

- Include "21+ only" in caption copy and, when space allows, a small footer.
- No price, sale, discount, inventory, availability, "DM to buy", order, giveaway, sample, or marketplace language.
- No health, wellness, safer, clean, light, low-risk, stress relief, therapeutic, or modified-risk claims.
- Avoid making the avatar actively smoke. Use cigar-culture objects, humidor scenes, lounge ambience, ash/cut/light B-roll, and editorial boards instead.
- Keep the CTA as comments, saves, follows, or "read the Cigar Flow desk", not purchase intent.
- Facebook remains the safest active public lane in this repo because the Page is already 21+ restricted. YouTube Shorts is useful for discovery but likely not monetization-friendly for tobacco-related content. TikTok/Instagram should be treated as experimental and high-enforcement-risk unless the post is clearly organic, editorial, adult, and non-commercial.

## Avatar Direction

Working name: Cigar Flow Concierge.

The three supplied images imply a warm, witty Black male cigar-culture personality with long locs, expressive face, premium lounge energy, and a small sense of celebration. The avatar should feel like an adult 21+ editorial host, not a salesman.

Recommended HeyGen appearance prompt:

```text
Realistic half-body portrait of a charismatic Black male cigar concierge in his late 30s to early 40s, long neat locs, warm knowing smile, expressive eyes, trimmed mustache and goatee, subtle gold hoop earring. Wardrobe: black velvet concierge jacket over a deep forest green shirt, small brushed brass lapel pin, refined but approachable. Setting: upscale cedar humidor lounge with walnut shelves, brass details, champagne key light, soft depth, luxury cigar magazine mood. The presenter is confident, calm, witty, and editorial. No active smoking, no readable brand labels, no text, no logos.
```

Recommended settings:

- Age: Early Middle Age
- Gender: Man
- Ethnicity: Black
- Style: Realistic
- Orientation: vertical
- Pose: half_body

True photo/reference avatar note:

- The HeyGen connector accepts hosted HTTPS image URLs or existing HeyGen asset IDs for photo/reference creation.
- The three supplied images are local files, and the connector currently does not expose a local asset upload tool.
- Best path for a true image-based avatar: upload the images in HeyGen or provide hosted HTTPS URLs/asset IDs.
- Best path for immediate iteration: create a prompt-based avatar from the approved description above.

Voice direction:

- Tone: smooth concierge, warm authority, lightly amused, never announcer-heavy.
- Energy: medium, confident, conversational.
- Candidate public HeyGen voices to audition: Chill Brian, Reassuring Rupert, Dynamic Derek, Archer, David Castlemore.

## Visual System

Format:

- 9:16 vertical.
- 18 to 28 seconds for most posts.
- First frame must move or reveal an object: humidor drawer, cigar rest, ash macro, wrapper close-up, journal page, release board, lounge door, or press-wire map.
- Avatar appears as the host, but the frame should keep moving through B-roll, motion graphics, and text cards.

Style:

- Primary: Velvet Standard - black, ivory, brass gold, walnut, deep green, slow premium cuts.
- Secondary for high-energy editorial moments: Deconstructed - dark grey, rust, angled type, fast cuts.
- Keep Yuzu luxury standard: full-bleed imagery, one focal object, restrained mark, no dense bullets, no heavy black boxes.

Background/B-roll sources:

- Existing site assets under `public/assets/news/cigar-flow-*.jpg`.
- Existing vertical Cigar Flow clip: `public/assets/cigar-flow-clip-01.mp4` is 1080x1920, 56.2s, H.264/AAC.
- Live/public asset URLs can be used by HeyGen if needed, for example `https://www.yuzucigarclub.com/assets/news/cigar-flow-release-desk.jpg`.
- HeyGen Video Agent can also generate stock/motion-graphic backgrounds when custom local upload is not available.

Text rules:

- Hook text visible in frame 1.
- 4 to 7 words for the main headline.
- 5 to 10 words per second max on text overlays.
- Use captions throughout.
- Keep a small footer: "Adult 21+ only. Editorial, not marketplace."

## Recurring Video Formats

1. The 20-Second Flow
   - Purpose: fastest recurring news signal.
   - Hook: "You missed three cigar signals."
   - Structure: hook, 3 quick signals, save/comment CTA.

2. Worth The Deeper Read
   - Purpose: tell viewers why a release/event/story matters without selling it.
   - Hook: "Everybody posts the drop. We ask why."
   - Structure: release noise, maker/story context, what Cigar Flow tracks.

3. Cigar Myth Desk
   - Purpose: education that earns saves.
   - Hook: "Most cigar posts get this backwards."
   - Structure: myth, correction, observation cue.

4. Lounge Signal
   - Purpose: community and venue culture.
   - Hook: "The best lounge tells you this first."
   - Structure: scene, etiquette/culture cue, discussion prompt.

5. Concierge Save
   - Purpose: repeatable save-worthy tip.
   - Hook: "Save this before your next humidor check."
   - Structure: one tip, one mistake, one comment question.

## Ready Pilot Scripts

### Pilot 1 - What Cigar Flow Is

Target length: 22 seconds.

Voice:

```text
Three signals from the cigar world, no sales pitch.
One: release noise is loud, so watch what makers repeat.
Two: lounge culture tells you what people actually gather around.
Three: your notes beat the hype.
That is Cigar Flow: save the signal, skip the noise.
Adult 21+ only.
```

Critical on-screen text:

```text
CIGAR FLOW IN 20 SECONDS
3 SIGNALS
NO SALES PITCH
SAVE THE SIGNAL
21+ ONLY
```

Background direction:

- Open on a humidor drawer or press-wire board.
- Cut to three fast cards: Maker Signal, Lounge Signal, Humidor Signal.
- End on avatar with a small Cigar Flow board behind him.

CTA:

```text
Comment "flow" if you want the weekly signal board.
```

### Pilot 2 - The Deeper Read

Target length: 24 seconds.

Voice:

```text
Everybody posts the drop.
Cigar Flow asks the better question: why does this one matter?
Maker history, blend story, event timing, and what adult collectors are actually discussing.
If it does not teach us something, it does not make the board.
Adult 21+ only.
```

Critical on-screen text:

```text
EVERYBODY POSTS THE DROP
WHY DOES IT MATTER?
MAKER HISTORY
BLEND STORY
LOUNGE SIGNAL
21+ ONLY
```

Background direction:

- Open with a release calendar close-up.
- Use motion graphics as a corkboard: history, blend, timing, discussion.
- Keep cigar products abstract/unbranded unless a published Cigar Flow story has source-safe images.

CTA:

```text
What should we track next: releases, lounges, or humidor lessons?
```

### Pilot 3 - Wrapper Myth Desk

Target length: 20 seconds.

Voice:

```text
Wrapper color gives clues, not the whole verdict.
Look at texture, aroma, burn behavior, and how the first inch changes.
The full blend is doing more work than the feed usually admits.
That is the kind of note worth saving.
Adult 21+ only.
```

Critical on-screen text:

```text
COLOR IS A CLUE
NOT THE VERDICT
TEXTURE
AROMA
FIRST INCH
SAVE THE NOTE
21+ ONLY
```

Background direction:

- Macro wrapper pan with three tones.
- Animated callouts stay small and premium.
- Avatar enters for the final line only.

CTA:

```text
What wrapper note do you actually trust?
```

### Pilot 4 - Lounge Signal

Target length: 18 seconds.

Voice:

```text
A good lounge is not just chairs and smoke.
Watch the table: clean trays, good spacing, easy conversation, and nobody turning the room into a sales floor.
That is the signal.
Adult 21+ only.
```

Critical on-screen text:

```text
THE LOUNGE SIGNAL
CLEAN TRAYS
GOOD SPACING
BETTER CONVERSATION
NO SALES FLOOR
21+ ONLY
```

Background direction:

- Lounge door reveal, table detail, ashtray, chair spacing.
- Avoid heavy smoking shots.
- End with the concierge nodding in a quiet lounge environment.

CTA:

```text
What lounge habit makes the whole room better?
```

### Pilot 5 - Weekly Cigar Flow Template

Target length: 25 seconds.

Voice:

```text
This week's Cigar Flow board has three lanes.
One maker signal worth reading.
One lounge or event note worth saving.
One humidor lesson you can use before the next cigar.
No marketplace noise, just adult cigar culture with context.
Adult 21+ only.
```

Critical on-screen text:

```text
THIS WEEK'S FLOW
MAKER SIGNAL
LOUNGE NOTE
HUMIDOR LESSON
NO MARKETPLACE NOISE
21+ ONLY
```

Background direction:

- Reusable template with three vertical cards.
- Swap in source-safe Cigar Flow story image URLs when today's published story exists.
- If no current published story exists, use evergreen education/lifestyle visuals.

CTA:

```text
Which lane should get the deeper read?
```

## HeyGen Prompt Template

Use this after avatar and voice approval.

```text
Create a 9:16 vertical social video for adult 21+ cigar culture. The selected presenter is a premium Cigar Flow concierge. One topic only: [TOPIC].

Narration should be confident, warm, witty, and editorial. Keep the presenter from actively smoking. Use the presenter as the host, with premium lounge, humidor, journal, ashtray, maker-board, and editorial motion-graphic B-roll behind and around him.

Script:
[SCRIPT]

CRITICAL ON-SCREEN TEXT:
[TEXT LINES]

This script is a concept and theme to convey - not a verbatim transcript. You have full creative freedom to expand, elaborate, add examples, and fill the duration naturally. Do not pad with silence or pauses.

Compliance: adult 21+ only. This is editorial culture and education, not a marketplace post. Do not include pricing, discounts, inventory, sales prompts, order language, giveaways, samples, or health/safer/therapeutic claims.

Visual style: premium cigar magazine, black leather, walnut, cedar, brass, champagne key light, deep green accents, restrained typography, sharp macro B-roll, smooth cuts, captions throughout. Use motion graphics for the text cards, stock or AI-generated lounge/humidor visuals for atmosphere, and clean caption-safe spacing.
```

## Production Plan

1. Approve avatar identity.
2. Choose true image-based path or prompt-based path.
3. Pick a voice from the HeyGen shortlist.
4. Generate Pilot 1 in HeyGen as a 9:16 video.
5. Review first 3 seconds, captions, background coherence, and compliance language.
6. If the avatar/background looks right, batch Pilots 2 and 3.
7. Save the avatar state locally once HeyGen returns the final avatar and voice configuration.
8. Convert each newly published Cigar Flow story into the Weekly Cigar Flow Template.

## Open Decisions

- Avatar path: hosted image/reference avatar or prompt-based concierge.
- Avatar wardrobe: black velvet concierge jacket or more casual green/black lounge style.
- Voice: smooth calm concierge or slightly more energetic creator host.
- Primary platform for the first run: Facebook Reels/Stories, YouTube Shorts, or both.
