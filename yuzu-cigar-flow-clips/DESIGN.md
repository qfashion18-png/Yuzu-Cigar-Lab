# Design System

## Overview

Yuzu Cigar Flow clips use the existing Yuzu Cigar Club private-lounge identity, adapted for vertical short-form feed viewing. The clip should feel like a polished member reader: dark, editorial, dense enough to scan quickly, and focused on real feed cards rather than decorative cigar motifs.

## Colors

- Night Background: `#030504`
- Ink Surface: `#07110D`
- Card Surface: `#101812`
- Forest Surface: `#0A1C14`
- Accent Gold: `#DCA93A`
- Gold Highlight: `#F3C86C`
- Cream Text: `#F8EDD7`
- Muted Text: `#B8AA8F`
- Line Gold: `#DCA93A57`

## Typography

- Display Serif: Georgia, `"Times New Roman"`, serif for major titles, feed headlines, and stat values.
- Interface Sans: Inter, ui-sans-serif, system-ui for labels, metadata, excerpts, tags, and metrics.
- Numbers use tabular figures where they appear in stat or metric cells.

## Motion

- Use calm luxury pacing: blur crossfades between scenes, slow image drift, gold labels entering with restrained directional motion.
- Each feed card gets a clear entrance sequence: topbar, image, type pill, source metadata, headline, excerpt, tags, metrics.
- Do not animate individual elements out between feed scenes. The incoming scene transition handles the handoff.

## Do's And Don'ts

- Do keep every card legible on a vertical 1080x1920 canvas.
- Do keep the ten-feeds-per-clip rule visible in the interface chrome.
- Do use actual feed imagery and member content from the Cigar Flow model.
- Do not use novelty smoke effects, cartoons, bright gradients, or oversized talking-head elements.
- Do not make the video feel like a generic promo; it should feel like the feed itself has become watchable.
