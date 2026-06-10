# Yuzu Facebook Organic Growth Implementation

Date: 2026-06-01  
Scope: no paid ads; no tobacco sales language; adult 21+ community growth for the Yuzu Cigar Club Facebook Page.

## Implementation Status

- Created a 30-day organic content calendar in `docs/facebook-organic-content-calendar-2026-06.csv`.
- Added a local compliance checker in `scripts/facebook-organic-growth-check.ts`.
- Added `npm run facebook:organic-check` to validate planned copy before posting.
- Verified the stored Meta Page credentials can read the Yuzu Cigar Club Page through the Graph API.
- Prepared exact Page, Group, and outreach copy below.
- Published the first Page seed post after approval.

Live platform status:

- Facebook Page: published as `Yuzu Cigar Club`.
- Facebook Page public URL: `https://www.facebook.com/profile.php?id=61590510062739`.
- Facebook Page Graph ID: `1148511071677542`.
- Facebook Page age restriction: `People 21 and over`, verified in Facebook settings and Graph API on 2026-06-01.
- Facebook Page profile: website `https://www.yuzucigarclub.com/`, contact email `support@yuzucigarclub.com`, profile image, cover image, and adult 21+ community/education-forward About and Description are live. On 2026-06-08, Graph API was used to remove more commerce-forward wording from the Page metadata and add explicit no-marketplace framing for monetization-readiness.
- Facebook Page visitor controls: visitor posting, photo posting, and photo tagging are off; messaging remains on.
- Facebook Page optional physical address/phone prompts were left blank because no verified public address or phone is present in the project contact metadata.
- Facebook Page cleanup: deleted two unintended feed items, leaving only the intentional intro, humidor-check, Cigar Flow, and automatic profile/cover update posts.
- Page seed post: published on 2026-06-01 as `1148511071677542_122099408559350335`.
- Page seed post permalink: `https://www.facebook.com/122099394543350335/posts/122099408559350335`.
- Page Cigar Flow image post: published on 2026-06-01 as `1148511071677542_122099433969350335`.
- Page Cigar Flow post permalink: `https://www.facebook.com/122099394543350335/posts/122099433969350335`.
- Facebook Group: created on 2026-06-01 as `https://www.facebook.com/groups/1702820237822858`.
- Facebook Group status: Private, Visible, 21+ membership questions configured, group rules configured, new member intro turned on, and welcome post pinned to Featured.
- Facebook Group admin controls: only admins/moderators can approve member requests, anonymous participation is off, and post approval is on for all posts.
- Facebook Group assets: uploaded the Yuzu launch assets album with 3 photos and set the group cover to the Yuzu cover asset.
- Facebook Group album: `https://www.facebook.com/media/set/?set=oa.27647210981530422&type=3`.
- Facebook Group Cigar Flow album: `https://www.facebook.com/media/set/?set=oa.2797279673982804&type=3`.
- Page membership explainer Reel/video: published on 2026-06-01 as `1938883936832335`.
- Page membership explainer permalink: `https://www.facebook.com/reel/1938883936832335/`.
- Facebook Group membership explainer post: published on 2026-06-01 by sharing the live Page Reel preview into `https://www.facebook.com/groups/1702820237822858`.
- External Facebook group wave: prepared on 2026-06-02 in `docs/facebook-external-group-post-kit-2026-06-02.md` with six admin-review drafts and six Yuzu-logo-badged images under `output/social/facebook-group-posts-2026-06/`.
- Facebook Group interest post: published on 2026-06-05 as `https://www.facebook.com/groups/1702820237822858/posts/1706593970778818/`.
- NBA Finals Game 2 watch-thread package: published to Instagram and the Facebook Page on 2026-06-05; Group and Threads publish attempts were blocked by current platform/tooling permissions.

## Core Channel Model

Use the Facebook Page as the official front door:

- Brand identity, public credibility, event recaps, short education posts, and comment prompts.
- Soft calls to action only: `Join the Club`, `Learn more`, `See upcoming events`, `Follow along`.
- No price, inventory, discount, availability, checkout, or direct purchase language.

Use a separate private, visible group as the community room:

- Human-administered group, not dependent on Page-linked group features.
- Adult 21+ membership screening.
- Discussion first: humidor care, pairings, lounge etiquette, event roll calls, cigar culture, and member photos.
- No buying, selling, trading, giveaways, free samples, or reduced-risk claims.

Use partner outreach as the distribution engine:

- Ask lounges, clubs, and event operators about co-hosted adult 21+ experiences.
- Ask media/creator partners about interviews, event coverage, or educational collaborations.
- Do not ask any partner to provide consumer/member lists.

## Image-Rich Cross-Channel Standard

2026-06-08 update: the Instagram page is disabled, so future active public scheduling should target the Facebook Page and Facebook Group first. Keep vertical MP4 assets reusable for Facebook Reels/Stories and future Instagram recovery, but do not require Instagram as an active target in validation or scheduling.

2026-06-09 update: education posts now need richer instruction copy and clearer visual explanation. Do not publish a short prompt with only a cover-style image. Page education posts should use a cover plus 3 to 5 step/detail cards where possible; the fallback is one detailed visual guide image plus the source package for follow-up cards. Group prompts should include at least one visual detail card, diagram, or step image before posting. Captions should include a hook, concrete steps or cues, a common mistake or reset step, a specific comment question, and adult 21+ / no-marketplace framing.

Every public social idea should become a native three-channel package:

- Instagram: use the strongest available format for the idea, usually a 4:5 feed image, carousel, Reel, or Story asset.
- Facebook Page: publish the official brand version as an image, album, video, Reel share, or visual prompt.
- Facebook Group: publish the discussion-first version using the same core visual, adapted as an album, prompt image, Reel share, or group-friendly discussion post.

Do not publish text-only Page or Group posts going forward. If a calendar row starts as a prompt, first attach or create a visual: an environmental humidor/lounge photo, a branded prompt card, an education carousel, a sourced editorial image set, or a short video/Reel. Captions should lead with a hook or concrete question, stay short enough to invite replies, and keep the adult 21+ / no-marketplace framing. Generated social video still follows the ongoing rule: include an audio track unless the user explicitly asks for silence, avoid synthetic tone/drone beds, and verify audio/video before upload.

Active Facebook-first month schedule:

- `docs/yuzu-facebook-first-month-post-schedule-2026-06-09.csv`
- Runs from 2026-06-09 through 2026-07-08.
- Focuses on luxury education posts and group prompts: ash technique, wrapper meaning, cut styles, humidor consistency, strength/body/flavor, lighting, pairings, resting cigars, cigar anatomy, ring gauge, tasting notes, patio etiquette, travel humidor checks, and Cigar Flow editorial signals.
- Validate with `npm run facebook:month-check`.

Creative standard:

- `docs/yuzu-luxury-social-creative-standard-2026-06-08.md`

## Facebook Group Setup

Recommended name:

```text
Yuzu Cigar Club Lounge | 21+
```

Live URL:

```text
https://www.facebook.com/groups/1702820237822858
```

Live media album:

```text
https://www.facebook.com/media/set/?set=oa.27647210981530422&type=3
```

Live Cigar Flow album:

```text
https://www.facebook.com/media/set/?set=oa.2797279673982804&type=3
```

Privacy:

```text
Private
```

Visibility:

```text
Visible
```

Description:

```text
Yuzu Cigar Club Lounge is an adult 21+ community for cigar culture, humidor care, pairings, events, and good conversation.

This group is not a marketplace. No buying, selling, trading, giveaways, free samples, pricing posts, inventory posts, or reduced-risk health claims are allowed. Membership is for adults 21+ only.

Official site: https://www.yuzucigarclub.com/
```

Membership questions:

```text
1. Are you 21 years of age or older?
2. What brings you to the Yuzu Cigar Club Lounge: humidor care, pairings, events, collecting, lounge culture, or something else?
3. Do you agree not to post buying, selling, trading, giveaway, free sample, pricing, inventory, or health-claim content?
```

Membership gate:

```text
Decline anyone who does not clearly confirm they are 21+ or who refuses the group rules.
```

New member intro:

```text
Welcome to the Yuzu Cigar Club Lounge. 21+ only. Start with humidor care, pairings, events, lounge culture, and collection photos. No buying, selling, trading, giveaways, pricing, inventory, order requests, or health claims.
```

Admin controls:

```text
Who can join: Only profiles.
Who can approve member requests: Only admins and moderators.
Who is preapproved to join: Nobody.
Anonymous participation: Off.
Who can post: Anyone in the group.
Post approval: All posts.
Default tab: Discussion.
```

Group rules:

```text
1. Adults 21+ only.
2. No buying, selling, trading, giveaways, free samples, pricing, inventory, or order requests.
3. No medical, wellness, safer, light, clean, low-risk, or modified-risk claims.
4. Keep posts focused on cigar culture, humidor care, pairings, etiquette, events, and community.
5. Respect members, lounges, makers, and local laws.
6. Admins may remove posts or members to keep the group compliant and useful.
```

Pinned welcome post:

```text
Welcome to the Yuzu Cigar Club Lounge.

This is a 21+ room for cigar culture, humidor notes, pairings, event roll calls, collection photos, and slower conversations.

Start here:
- What are you keeping your humidor at this week?
- What cigar taught you the most about your palate?
- What local lounge has been treating you right lately?

Quick reminder: no buying, selling, trading, giveaways, free samples, pricing, inventory posts, or health claims. Keep it adult, respectful, and useful.
```

## First Page Seed Post

Published on 2026-06-01:

```text
Humidor check, Yuzu lounge.

What RH are you running this week, and what has been resting longer than you expected?

We are building this Page around adult 21+ cigar culture, storage, pairings, events, and good conversation. Drop a note below if you are a collector, a lounge regular, or just getting your humidor dialed in.

21+ only.
```

Suggested asset:

```text
New standard: use an environmental humidor or lounge photo plus a 4:5 Instagram/social prompt card. Do not use a product-only or box-stack image.
```

## Cigar Flow Image Post

Published to the Page on 2026-06-01:

```text
Cigar Flow | May 31 industry highlights

New Releases
Oliva Serie V Maduro, Perdomo 20th Anniversary, and Foundation Wise Man Maduro are the source-backed watch notes in today's flow.

Upcoming Events
PCA 2026 coverage adds the event side of the story, with show-floor release signals and industry context.

Flow Note
This is a news-and-culture scan for adult cigar readers, not a marketplace post. 21+ only.

Read the Cigar Flow format on Yuzu:
https://www.yuzucigarclub.com/cigar-flow#cigar-flow-news
```

Page permalink:

```text
https://www.facebook.com/122099394543350335/posts/122099433969350335
```

Published to the Group as a four-image album on 2026-06-01:

```text
https://www.facebook.com/media/set/?set=oa.2797279673982804&type=3
```

The album description was updated after publishing so the Group post carries the Cigar Flow story text, including `New Releases`, `Upcoming Events`, and `Flow Note`.

Images used:

- `public/assets/news/researched/oliva-serie-v-maduro.jpg`
- `public/assets/news/researched/perdomo-20th-anniversary-maduro.jpg`
- `public/assets/news/researched/foundation-wise-man-maduro.jpg`
- `public/assets/news/researched/pca-2026-trade-show.jpg`

## Membership Explainer Video Post

Published to the Page on 2026-06-01:

```text
Yuzu membership is built around adult 21+ cigar culture: digital humidor tools, curated cigar experiences, concierge guidance, education, events, and support.

The goal is simple: make your cellar easier to understand and your notes easier to keep.

21+ only. Learn more: https://www.yuzucigarclub.com/membership
```

Page Reel/video:

```text
https://www.facebook.com/reel/1938883936832335/
```

Published to the Group on 2026-06-01 by sharing the live Page Reel preview with this caption:

```text
Yuzu membership is built around adult 21+ cigar culture: digital humidor tools, curated cigar experiences, concierge guidance, education, events, and support.

The goal is simple: make your cellar easier to understand and your notes easier to keep.

Watch the membership explainer:
https://www.facebook.com/reel/1938883936832335/

21+ only.
```

Asset:

- `yuzu-membership-explainer-facebook-2026-06-01/renders/yuzu-membership-explainer-facebook-2026-06-01.mp4`

Verification:

- Rendered video is 1080x1920, 63 seconds, H.264/AAC, about 14.4 MB.
- HyperFrames `validate` passed with 0 errors and 1 browser AudioContext warning.
- HyperFrames `inspect --json` passed with 0 layout issues over 9 timeline samples.
- Visual frame review used `yuzu-membership-explainer-facebook-2026-06-01/snapshots/facebook-verify/contact-sheet.jpg` plus full-size sampled frames.
- Facebook Graph readback returned the Page video status as ready, processing complete, and publishing complete.
- Group feed DOM verification showed the caption, private-group post, and playable Page Reel preview.

## Group Interest Post

Published on 2026-06-05 as a Group discussion post:

```text
https://www.facebook.com/groups/1702820237822858/posts/1706593970778818/
```

Caption:

```text
Question for the lounge: what would make an adult 21+ cigar club feel worth your time - a more useful humidor record, better tasting notes, pairing ideas, local lounge meetups, or deeper cigar education?

Yuzu Cigar Club is being built around the slower side of cigar culture: storage, notes, pairings, events, and respectful conversation.

What should we build around first?

21+ only.
```

Asset:

- `output/social/yuzu-group-interest-2026-06-05/yuzu-group-interest-fb-group-square.png`

Posting note:

- Use in the Yuzu Group as a discussion starter. If adapted for an external Facebook group, ask the group admin before using a branded visual or link, and keep the caption link-free unless rules explicitly allow links.

## NBA Finals Game 2 Watch Thread

Published on 2026-06-05 after verifying the official NBA schedule listed Finals Game 2 as New York at San Antonio on June 5 at 8:30 PM ET / 5:30 PM Phoenix time.

Caption:

```text
Finals Game 2 watch thread: Knicks at Spurs tonight, 5:30 PM AZ / 8:30 PM ET.

What are you smoking for the game: mellow, bold, maduro, or something you have been letting rest?

Drop the cigar style and one tasting note.

21+ only. No marketplace posts, pricing, inventory, or health claims.
```

Assets:

- `output/social/nba-finals-game-2-2026-06-05/nba-finals-game-2-ig-4x5.jpg`
- `output/social/nba-finals-game-2-2026-06-05/nba-finals-game-2-fb-page-landscape.jpg`
- `output/social/nba-finals-game-2-2026-06-05/nba-finals-game-2-fb-group-square.jpg`
- `output/social/nba-finals-game-2-2026-06-05/nba-finals-game-2-contact-sheet.jpg`

Published:

- Instagram: `https://www.instagram.com/p/DZOQDATAeHD/`
- Facebook Page: `https://www.facebook.com/122099394543350335/posts/122102403957350335`

Blocked:

- Facebook Group: Graph API returned missing-permission/unsupported-operation error for the group, and the in-app browser composer could not type/paste because its virtual clipboard helper was unavailable. No Group duplicate or partial post was left behind.
- Threads: the Threads web profile loaded logged out and `ycc/social/threads/prod` still has no Threads API access token or account id.

## Cigar Flow June 1-5 Cross-Channel Package

Published on 2026-06-05 as an Instagram carousel, Instagram Story, and Facebook Page album.

Live posts:

- Instagram carousel: `https://www.instagram.com/p/DZOPbEKAQs8/`
- Instagram carousel media ID: `18092669123590040`
- Instagram Story media ID: `17990943923975534`
- Facebook Page album: `https://www.facebook.com/122099394543350335/posts/122102402739350335`
- Facebook Page post ID: `1148511071677542_122102402739350335`

Assets:

- `output/social/cigar-flow-june-1-5-2026/ig-carousel/`
- `output/social/cigar-flow-june-1-5-2026/facebook/`
- `output/social/cigar-flow-june-1-5-2026/cigar-flow-june-1-5-story-video.mp4`
- `output/social/cigar-flow-june-1-5-2026/cigar-flow-june-1-5-contact-sheet.jpg`
- `output/social/cigar-flow-june-1-5-2026/POST-KIT.md`

Verification:

- HyperFrames lint returned 0 errors and one non-blocking dense-track warning.
- HyperFrames validate returned 0 errors and one non-blocking browser AudioContext warning.
- HyperFrames strict inspect returned 0 layout issues across 9 sampled timeline points.
- Final Story video audio passed the no-static gate: AAC stereo, 24.021s, integrated loudness -25.8 LUFS, true peak -6.9 dBFS, 0 clip ratio, no `silencedetect` events, static-like spectral flag false.
- The first render's overly quiet tail was fixed by rebuilding a clean 24s audio bed before publish.
- Instagram Graph readback returned the live carousel permalink and active Story ID.
- Facebook Graph readback returned the live Page album ID, permalink, message, and five attached media IDs.
- Facebook Group Graph publish attempts failed for both Page and system-user tokens with unsupported group feed requests, matching earlier project notes that group posts require the Facebook UI. `POST-KIT.md` includes the exact group share copy and live Page album link.

## Weekly Cadence

Minimum weekly Page cadence:

- Monday: humidor care or storage prompt.
- Wednesday: education or etiquette mini-post.
- Friday: pairing or lounge-culture question.
- Sunday: event recap, member-style prompt, or founder note.

Minimum weekly Group cadence:

- Monday: weekly humidor check thread.
- Thursday: pairing thread.
- Saturday: lounge roll call or member photo thread.

Weekly admin rhythm:

- Monday: check Page post reactions and manually invite eligible engagers to follow the Page where Facebook offers that option.
- Tuesday: approve/decline group members using the 21+ questions.
- Wednesday: comment from a human founder/admin profile in 3 to 5 relevant groups or partner pages.
- Thursday: send 2 to 3 partner outreach messages from the lead CSV.
- Friday: respond to every meaningful Page and Group comment.
- Sunday: record metrics.

## First-Wave Partner Actions

Use `docs/yuzu-cigar-outreach-leads-2026-05-30.csv` as the source list.

Week 1 priority:

- Valley Cigar Club
- Ash Hole Cigar Club
- Fat Buddha Cigar Club
- Ambassador Fine Cigars
- Churchill's Fine Cigars
- Castro's Cigar Bar
- Puro Cigar Bar

Week 2 priority:

- Magnum's Cigars Wine & Liquor
- Cedar Room Fine Cigars & Lounge
- Fumar Cigars
- Sticks Golf & Cigar Lounge
- Smoke N The Desert / Phoenix Cigar Week
- Cigar Coop
- halfwheel

Partner pitch:

```text
Hi [Name],

I am reaching out from Yuzu Cigar Club, an adult 21+ cigar community built around humidor care, cigar culture, and small member experiences.

I noticed [specific group/lounge/event] and thought there may be a fit for a simple adult-only community collaboration, event listing, or co-hosted lounge night.

We do not market to anyone under 21, do not ask partners for member lists, and avoid free tobacco giveaways or unsupported health claims.

Would you be open to a short conversation?

Best,
[Name]
Yuzu Cigar Club
https://www.yuzucigarclub.com/
```

## Commenting Rules For Other Groups

Allowed:

- Answer storage, RH, etiquette, pairing, and event questions.
- Share short educational context.
- Mention Yuzu only when directly relevant and allowed by the group rules.
- Ask admins before posting a link or event.

Avoid:

- Direct links on first interaction.
- Asking members to buy, DM, order, or join a paid offer.
- Product-only photos with brand-heavy captions.
- Posting the same comment in many groups.

## Measurement

Track every Sunday:

- Page followers.
- Page post reach.
- Page comments.
- Page shares.
- Group member count.
- Group active contributors.
- Partner replies.
- Event RSVPs or inquiries.
- Site visits from Facebook, if available in analytics.

Simple 30-day target:

- 4 Page posts per week.
- 3 Group threads per week once the group exists.
- 2 to 3 partner outreach messages per week.
- 20 meaningful comments or replies from the Yuzu founder/admin account.
- At least one local adult 21+ event collaboration conversation opened.

## Compliance Guardrails

Treat these as default blockers for Meta copy:

- Do not use: buy, order, sale, discount, promo, coupon, free, giveaway, sample, in stock, available now, DM to order, lowest price, ships nationwide.
- Do not imply cigars are safe, healthy, cleaner, light, low-risk, therapeutic, or medicinal.
- Do not target or appeal to anyone under 21.
- Do not run paid ads or paid partnership tobacco promotion.
- Do not automate scraping, private DMs, or group-member harvesting.
- Do not repost removed or restricted Meta content without changing the underlying issue.

Preferred language:

- `cigar culture`
- `humidor care`
- `pairing notes`
- `lounge conversation`
- `adult 21+ community`
- `event recap`
- `learn more`
- `join the club`
- `follow along`

## 2026-06-09 Group Follower Information Post Wave

Prepared a follow-up organic growth wave for adults looking for cigar information. The package fixes the layout of the original owned-group follower prompt and adds a separate group-specific prompt/caption for each tracked external group.

Package:

- `output/social/yuzu-page-follow-group-post-2026-06-09/POST-KIT.md`
- `output/social/yuzu-page-follow-group-post-2026-06-09/yuzu-page-follow-group-post-square.png`
- `output/social/yuzu-page-follow-group-post-2026-06-09/group-specific-assets/`
- `output/social/yuzu-page-follow-group-post-2026-06-09/yuzu-group-follower-posts-contact-sheet.jpg`
- Renderer: `scripts/render-yuzu-page-follow-group-post.mjs`

Target groups:

- Yuzu Cigar Club Lounge | 21+
- Valley Cigar Club
- Ash Hole Cigar Club Phoenix / chapter community
- Tap N Ash Social Club and Cigar Lounge Fan Club
- Cigar Connoisseurs
- Black Cigar Smokers
- Hollow Down Online Group

Posting model:

- Owned Yuzu group: ready after normal admin review.
- External groups: admin-review only, no direct links, and remove the Yuzu follow sentence if moderator rules disallow self-promotion.
- Each prompt is information-first and group-specific: desert humidor care, community lessons, lounge culture, tasting notes, mentorship, or podcast-style conversation.
