# PriceList image backfill — 2026-09-22

Twelve generated photos fill 22 previously blank `imageUrl` rows across 13 item codes. `ITM-0087`
and `ITM-0088` share one foam-doll photo because both describe the same material and item.
The JPEGs in `generated/` are the final 1024 × 1024 images uploaded to Firebase Storage.
The PNGs are the original ImageGen outputs, and `references/` contains sampled existing catalog
photos used to judge the style. `upload-manifest.json` records each item's Firebase URL;
`sync-report.json` records the API update result.

## Prompt set

All 12 images were generated with the built-in ImageGen tool using this shared direction:

> Use case: product-mockup. Square laundry price-list product photo. Realistic single-item catalog
> flat lay directly from above, centered on a warm off-white or very light cool-gray seamless
> surface. Soft diffuse studio light from the upper left, delicate natural shadow, believable
> material texture, full item visible with comfortable margins. Match the existing unbranded
> laundry catalog. No person, mannequin, hanger, hands, props, labels, logo, text, collage,
> border, or watermark.

| PriceList code | Subject added to the shared prompt | Final image |
| --- | --- | --- |
| ITM-0057 | White medical lab gown with lapels, buttons, and patch pockets | `generated/ITM-0057-lab-gown.jpg` |
| ITM-0087, ITM-0088 | Pale beige soft foam teddy bear doll with woven fabric texture | `generated/ITM-0087-0088-foam-doll.jpg` |
| ITM-0089 | Smooth matte natural-latex teddy bear toy | `generated/ITM-0089-latex-doll.jpg` |
| ITM-0090 | Muted dusty-blue short-sleeve cotton polo shirt | `generated/ITM-0090-polo-shirt.jpg` |
| ITM-0091 | Warm charcoal straight-leg tailored long trousers | `generated/ITM-0091-long-pants.jpg` |
| ITM-0092 | Muted olive-khaki casual knee-length shorts | `generated/ITM-0092-shorts.jpg` |
| ITM-0093 | Muted clay-pink knee-length A-line skirt | `generated/ITM-0093-skirt.jpg` |
| ITM-0094 | Plain warm-white sleeveless cotton undershirt | `generated/ITM-0094-undershirt.jpg` |
| ITM-0095 | Muted navy tailored single-breasted suit jacket | `generated/ITM-0095-suit-jacket.jpg` |
| ITM-0096 | Muted taupe button-front knitted cardigan | `generated/ITM-0096-cardigan.jpg` |
| ITM-0097 | Muted sage pullover hoodie with a kangaroo pocket | `generated/ITM-0097-hoodie.jpg` |
| ITM-0098 | Muted burgundy crew-neck knitted sweater | `generated/ITM-0098-sweater.jpg` |
