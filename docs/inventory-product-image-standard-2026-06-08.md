# Inventory Product Image Standard - 2026-06-08

Purpose: define the accepted cigar-box image scheme for Yuzu storefront inventory assets.

## Accepted Scheme

- Use a clean ecommerce product-photo tile.
- Use a white or near-white background. Preferred background is `#ffffff`; `#f8f6f0` is acceptable when a source photo needs a softer edge.
- Keep the cigar box as the hero subject. An open box with visible cigars is ideal, but a closed box is acceptable.
- A single matching cigar/stick beside the box is acceptable when it is part of the source or official-style product composition.
- Use a square canvas, preferably `1000x1000`.
- Keep the product centered and large enough to read as a box image in shop cards.
- Preserve real package colors and visible brand marks from the source image when possible.

## Avoid

- Do not add Yuzu UI framing, dark website backgrounds, gold borders, badges, price labels, shelf tags, or marketing copy inside the product image.
- Do not place product photos inside cards, panels, or decorative frames. The website already wraps images with `ReferenceImage` and the Yuzu luxury card styling.
- Do not generate fake claims, ratings, prices, discounts, or marketplace language into the image.
- Do not invent detailed packaging text when the source is not readable. Prefer a real distributor/source closed-box or open-box image over fabricated label text.

## Source Preference

1. Accepted vendor-style image on a white background.
2. Clean closed-box or open-box product image from the distributor/source system, standardized onto a square white/near-white canvas.
3. Shelf photos are audit evidence only. Use them to identify missing products/SKUs, not as final storefront product images, unless the user explicitly approves a temporary exception.
4. Generated placeholder only when no usable product/source box image exists, and only if it does not fabricate exact legal/package text.

## File Convention

- Save final storefront assets under `public/assets/inventory/cigars/`.
- Use lowercase slug filenames matching the inventory product slug where possible.
- Use `.jpg` for standard product tiles unless the source requires alpha or a transparent composition.

## 2026-06-08 Box Assets

These assets were corrected after the initial shelf-crop preview was rejected. Final storefront files use box-style product images from the distributor/source image pattern `https://swwest.com/Images/SunsetItems/{sku}/0.jpg`, normalized to `1000x1000` white ecommerce tiles:

- `public/assets/inventory/cigars/fonseca-mx-edition-robusto-20-bx.jpg`
- `public/assets/inventory/cigars/fonseca-mx-edition-toro-20-bx.jpg`
- `public/assets/inventory/cigars/nica-rustica-connecticut-short-robusto-25-bx.jpg`
- `public/assets/inventory/cigars/nica-rustica-adobe-toro-25-bx.jpg`
- `public/assets/inventory/cigars/nica-rustica-adobe-gordo-25-bx.jpg`
- `public/assets/inventory/cigars/nica-rustica-toro-25-bx.jpg`
- `public/assets/inventory/cigars/liga-undercrown-shade-robusto-25-bx.jpg`
- `public/assets/inventory/cigars/deadwood-dominicana-gordo-10-bx.jpg`
- `public/assets/inventory/cigars/aging-room-quattro-nicaragua-maestro-10-bx.jpg`

Preview contact sheet:

- `output/inventory-audit/generated-image-preview/inventory-cigar-box-assets-2026-06-08.jpg`

Raw source image downloads are retained for audit/rebuild traceability under:

- `output/inventory-audit/source-box-images-2026-06-08/`
