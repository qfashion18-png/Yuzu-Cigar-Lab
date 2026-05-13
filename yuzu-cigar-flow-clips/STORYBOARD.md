# Storyboard

## Format

- Canvas: 1080x1920 vertical
- Duration: 56.2 seconds with the current 9-card feed
- Rule: 10 feed cards per clip, implemented with `FEEDS_PER_CLIP = 10`

## Sequence

1. Opening slate with Yuzu mark, clip rule, and feed stats.
2. One animated feed-card scene per current Cigar Flow item.
3. Source map scene listing the monitored feed publishers.
4. Closing slate for continuing to the next ten Cigar Flow signals.

## Visual Notes

- Use the existing Yuzu lounge palette: black-green surfaces, cream typography, and gold rules.
- Use actual card imagery wherever available, localized into `assets/site`.
- Use blur crossfades as the primary transition so scenes feel related rather than chopped together.
