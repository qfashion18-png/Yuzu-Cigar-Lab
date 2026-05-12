# Lighter Assortment Research - 2026-05-11

## Recommendation

Retire the low-cost display/novelty torch assortment and publish only the support-backed Blazer and Vector models.

This keeps 8 published torch lighters from 127 active torch rows:

| SKU | Product | Why keep |
| --- | --- | --- |
| 20740 | BLAZER BIG BUDDY TORCH | Compact Blazer option from a proven torch brand. |
| 81248 | BLAZER BIG SHOT INDUSTRIAL TORCH | Best durable table/bench torch fit; strong reliability reputation, 2500 F flame, 35 minute burn time, one-year factory replacement warranty. |
| 31601 | BLAZER FIREFOX MINI TORCH | Smaller Blazer travel/compact option. |
| 31682 | VECTOR (ICON-IV/02) GUN METAL | Premium Vector Icon IV flat-flame lighter with No Proof Warranty support. |
| 31683 | VECTOR (ICON-IV/04) BLACK MATTE | Neutral premium Vector Icon IV option with No Proof Warranty support. |
| 41866 | VECTOR (PVECTORCH/03) COPPER GOLD DOUBLE TORCH | Vector Xcaliber double torch with built-in cutter and No Proof Warranty support. |
| 41867 | VECTOR (PVECTORCH/04) BLACK MATTE DOUBLE TORCH | Neutral Vector Xcaliber double torch with No Proof Warranty support. |
| 28551 | VECTOR (THRONE/1C) CHROME SATIN QUAD JET FLAME | Vector Throne quad jet option with No Proof Warranty support. |

## Removal Rationale

Remove the rest of the published `Lighters / Torch` SKUs from the storefront. The raw import can stay intact for source-of-record history, but these should not be shopper-facing.

| Brand/family | Active rows removed | Reason |
| --- | ---: | --- |
| Scorch | 57 | Too many overlapping display torches. Third-party manual sources indicate routine maintenance sensitivity around butane quality, weak flame, bleeding, and nozzle clogging. Better not to make these the default customer experience. |
| Tesla | 19 | Current rows are low-cost butane display torches, not clearly tied to the better-documented rechargeable Tesla Coil lighter warranty material. No strong model-level support signal found for these SKUs. |
| Maven | 10 | Maven has a warranty, but its own policy narrows in-store pocket-torch coverage; our rows look like low-cost display/pocket items rather than premium table torches. |
| Techno | 8 | Low-cost display SKUs with weak model-level support signals. |
| Smoxy | 7 | Low-cost display assortment with weak model-level support signals. |
| Eagle/Newport/Special Blue Avenger | 4 | Very low-cost lighter rows or unclear support; keep fuel products separately, but do not feature these torches. |
| Duplicate Blazer/Vector color rows | 14 | Keep one or two neutral colorways per reliable model to reduce clutter while preserving the best supported families. |

## Sources Checked

- Vector KGM official product pages document the No Proof Warranty, in-house repair technicians, and 1-2 week stated service turnaround for Vector lighters: https://vectorkgm.com/product/icon-iv/
- Vector official pages for Xcaliber and Throne confirm the double/quad models and the same No Proof Warranty support: https://vectorkgm.com/product/xcaliber-03-copper-gold-satin/ and https://vectorkgm.com/product/throne_06blue-matte/
- Blazer GT8000 Big Shot retailer documentation lists 2500 F output, up to 35 minutes burn time, piezo ignition, and a one-year factory replacement warranty from Blazer: https://www.ottofrei.com/products/blazer-gt8000-big-shot-butane-torch
- Blazer Big Shot product copy from an authorized retailer describes the anti-flare brass nozzle, piezo self-ignition, and Made in Japan construction: https://takoglass.com/product/blazer-big-shot-gt8000-torch/
- Maven official warranty page gives a one-year warranty for 5-pack/table torches but excludes/limits some pocket-torch scenarios and caps claims: https://maventorch.com/pages/warranty-returns
- CPSC has recent lighter/torch enforcement activity around products lacking required child-resistant mechanisms, which supports narrowing to brands with clearer service and compliance posture: https://www.cpsc.gov/Recall-Products/Micro-Torches

## Implementation Note

The storefront now uses `retiredLighterSkus` in `src/lib/catalog.ts` to suppress the retired SKUs while preserving the imported source data. This is reversible by removing SKUs from that set.
