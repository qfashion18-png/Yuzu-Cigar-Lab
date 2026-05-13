# Design System

## Overview

Yuzu Cigar Club uses a premium private-lounge identity for a cigar storefront, membership program, and digital humidor. The layout is editorial and dense: split hero panels, bordered product cards, stacked membership tiers, thin gold rule lines, and dashboard-like humidor stats. The palette stays almost entirely in deep black-green surfaces with cream serif headlines and gold accents. Photography carries the atmosphere: cigar boxes, polished wood, whiskey glass, low amber light, and branded Yuzu packaging.

## Colors

- **Night Background**: `#030504` - primary full-page background.
- **Ink Surface**: `#07110D` - deepest panel and button foreground tone.
- **Card Surface**: `#101812` - product cards, tier cards, and utility panels.
- **Forest Surface**: `#0A1C14` - elevated modal/panel surface and section bands.
- **Accent Gold**: `#DCA93A` - primary CTAs, borders, icons, prices, labels.
- **Gold Highlight**: `#F3C86C` - brighter gold glints and active details.
- **Cream Text**: `#F8EDD7` - primary text and Georgia headlines.
- **Muted Text**: `#B8AA8F` - body copy, product metadata, softer interface text.
- **Line Gold**: `#DCA93A57` - low-opacity border/rule treatment.
- **Compliance Red**: `#E55B48` - destructive/compliance warning accent only.

## Typography

- **Display Serif**: Georgia, `"Times New Roman"`, serif. Used for major headlines, product names, tier names, and luxury editorial moments. Weight is regular, with large video sizes and generous line-height.
- **Interface Sans**: Inter, ui-sans-serif, system-ui. Used for navigation, labels, buttons, dashboard stats, body copy, and dense product/member information. Use 700-900 for uppercase labels and 400-500 for readable copy.
- **Mono Fallback**: `"SFMono-Regular"`, Consolas, `"Liberation Mono"`, monospace. Use sparingly for tabular or operational details.
- **Hierarchy**: Hero/beat headlines should be 72px or larger in video. Body copy must stay 22px or larger. Labels should be 18px or larger with high tracking.

## Elevation

Depth is built with borders, photographic layering, and dark translucent overlays rather than soft SaaS shadows. Most components use 1px gold/green borders, dark panels, and occasional backdrop blur. Product and app imagery should sit in framed windows with gold hairlines, slight perspective, and amber glows instead of heavy drop shadows.

## Components

- **Split Editorial Hero**: Large Georgia headline on the left, full-bleed cigar box photography on the right, overlaid by a compact humidor stats widget.
- **Humidor Stats Widget**: Three top stats for humidity, temperature, and boxes, plus a CTA row; thin gold dividers and compact uppercase labels.
- **Non-Member Banner**: Full-width locked access strip with gold icon, muted explanation, and join/log-in controls.
- **Event Feature Panel**: Split image/text module with event date chips, gold icon metadata, and a single gold CTA.
- **Product Box Cards**: Tall dark cards with cigar-box crop, heart icon, product metadata, gauge/strength mini-cells, gold price, add button, and adult-signature note.
- **Membership Tier Stack**: Dense bordered tier rows/cards, gold highlighted "Most Popular" badge, and strong price/month metadata.
- **Benefit Strip**: Horizontal icon-label set separated by gold vertical rules.
- **Platform Roadmap Cards**: Numbered operational cards for age restriction, member metadata, allocations, humidor writes, order holds, and EventBridge audit events.
- **Digital Humidor Feature Grid**: Six bordered utility tiles for manual entry, QR add, scan labels, humidity log, reorder reminders, and pairing notes.
- **Host Presenter Tile**: Compact top-right guide overlay with a dark green glass panel, gold hairline border, restrained CSS portrait, beat-specific cue text, and voice-meter/mouth motion synced to the narration.

## Do's and Don'ts

### Do's

- Use `#DCA93A` gold as the recurring line, icon, and CTA accent.
- Keep scenes dark, warm, and photographic; cigar box imagery should be visible early and often.
- Use Georgia for the emotional statement and Inter for operational proof.
- Make panels feel like a premium member dashboard: dense, aligned, bordered, and calm.
- Use slow Ken Burns moves, gold rule drawing, stat counters, and restrained parallax.
- Keep the host presenter compact and editorial; it should clarify the voiceover without blocking product cards, screenshots, or compliance proof.

### Don'ts

- Do not switch into bright white, beige, neon, purple, or generic gradient palettes.
- Do not round cards heavily; keep corners restrained and close to the site's small radius.
- Do not make the promo text-only; the brand depends on cigar box photography and humidor UI.
- Do not use cartoon cigar motifs or novelty smoke effects.
- Do not hide the compliance/membership utility behind a pure luxury montage.
- Do not let the host tile become a large talking-head layout; it is a guided overlay, not the main scene.
