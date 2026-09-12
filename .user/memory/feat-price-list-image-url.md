# `feat/price-list-image-url`

## Goal

Add a photo per price-list item so staff pick by sight in the price table and both item pickers.

## Done

- Live `PriceList` sheet: `Q1` = `image_url`, header row now 17 cells; grid was already 26 wide.
- G Drive registry `PriceList.json`: `image_url` appended after `active`, not in `required`.
- `PriceList.db-contract.ts`, `price-list-api.schema.ts`, `price-list.module.ts` carry the field.
- 7 backend dry tests re-fixtured from 16 to 17 columns; all pass, plus 3 regression tests.
- The price-list card and both pickers display `imageUrl` with an icon fallback.
- Both pickers use two-column product cards with larger, uncropped photos; tested on the local order page.
- 41 photos were uploaded to Firebase Storage; 80 of 81 sheet rows have URLs.
- The browser cache version was bumped so old rows without `imageUrl` expire on deploy.

## Pending

- Open decision: whether `PriceListFormPage.vue` should author `imageUrl`. The API contract already
  accepts it on create/update; only the form payload omits it.
- Production still runs the old backend, which fails on the live sheet's `image_url` column Q.
- Deploy an integrated release containing the current main changes and this branch's backend/frontend work.
- `ITM-0057 เสื้อกาวน์` has no matching source photo and keeps a blank image URL.

## Gotchas

- `/api/price-list` is cached one hour and persisted to `localStorage`; a sheet edit is not visible
  on reload until the entry expires.
- The picker selection projections drop unknown row fields, so the image never reaches a created
  invoice line or order item. That is fine for a picker thumbnail.
