# Butane / Fluid Pricing Audit - 2026-05-22

Scope: storefront products that resolve to the `Butane / Fluid` category.

Pricing scheme applied: published butane and lighter-fluid rows use the researched online retailer price as the public/non-member price, and the member price is exactly 10% below that researched price. Book matches are retained in this category as lighting accessories, but they are not treated as butane or lighter-fluid rows for the 10% fuel discount rule.

## Online Price Checks

- Special Blue official store lists 300ml 9x butane at `$8.39`, matching SKU `10413`: https://specialblue.com/products/special-blue-9x-300ml-butane
- Grateful Green and Avernic Smoke Shop list Neon 5x 300ml butane at `$6.99`, matching SKU `5396`: https://shopgratefulgreen.com/products/neon-butane-5x-300ml and https://avernicsmokeshop.com/products/neon-butane-5x-refined-300ml
- Postmates/Hi Lite Liquor lists Neon 11x at `$10.99` and Neon 7x at `$8.99`, matching SKUs `6800` and `6801`: https://postmates.com/store/hi-lite-liquor-westminster/FqmH8TdgWrSZ_OLxu2qhJQ/a774adac-3639-5832-87c6-f158bd9ce501/9d480d3e-7d0b-4fbc-b32e-def34363dc45/a4780442-f980-5165-a46b-63c22b4dbd2e
- Lighter USA lists Ronson Butane Fuel 2.67oz/76g from `$7.95`; the catalog uses the researched multipack target for SKU `1242`: https://lighterusa.com/products/ronson-butane-fuel-2-67oz-76g
- Grow It Depot lists Ultra Pure Plus 420ml butane single and 12-pack options; SmokeDeal lists the 12-count Ultra Pure Plus 420ml BOGO target at `$71.99`, matching SKU `10027`: https://www.growitdepot.com/a/s/products/ultra-pure-plus-420ml-butane and https://smokedeal.com/smoke-shop/lighter-and-torches/butane/
- Up In Smoke America lists Vector Formula-14 butane from `$8.99` and the 330ml option at `$11.99`; SmokeDeal lists Vector X600 12-can target pricing, supporting the Vector butane review: https://upinsmokeamerica.com/products/vector-formula-14-times-filtered-premium-butane and https://smokedeal.com/smoke-shop/lighter-and-torches/butane/
- Zippo official lists 75ml butane at `$4.25`; that source row remains unpublished because the imported item has no source/member price yet: https://zippo.com/products/premium-butane-fuel
- The Cartwright Group confirms the book-match pack structure for Cartwright book matches; no strong current retail price was found for the exact Yuzu rows, so the existing imported market prices remain the source of truth for those non-fuel accessories: https://thecartwrightgroupllc.com/products/specs/32

## Category Hygiene

- `Z-ZEUS ZERO "GREEN" DOUBLE FLAME TORCH` (`41205`) was recategorized from `Butane / Fluid` to `Lighters / Torch` because it is hardware, not fuel.
- Its source image is preserved through a catalog image override so it does not inherit the local lighter studio-image convention.

## Remaining Hidden Rows

These rows are still not shopper-facing because the import has `price: 0` or because the product is blocked by missing source imagery. They should not be published until a current public price, member price, and usable image are confirmed:

- `32788` Clipper 133ml Lighter Fluid
- `6586` Clipper 138ml Gas Refill
- `89162` Gold Whip 5x Filtered Refined Premium Butane
- `75331` Gold Whip 7x Premium Butane
- `69877`, `69878`, `69879`, `69880` Neon case rows
- `30849` Special Blue Jumbo 9x Ultra Pure Butane
- `85469`, `10511`, `936` Vector zero-price rows
- `5672` Zippo 75ml Butane
