# `feat/price-list-image-url`

## Goal

Add a photo per price-list item so staff pick by sight in the price table and both item pickers.

## Done (committed)

- Live `PriceList` sheet: `Q1` = `image_url`, header row now 17 cells; grid was already 26 wide.
- G Drive registry `PriceList.json`: `image_url` appended after `active`, not in `required`.
- `PriceList.db-contract.ts`, `price-list-api.schema.ts`, `price-list.module.ts` carry the field.
- 7 backend dry tests re-fixtured from 16 to 17 columns; all pass, plus 3 regression tests.
- Verified against the live API: `priceListService.list()` returns `imageUrl: null` on every row.

## Not done

- Frontend: `PriceListCard.vue`, `InvoicePriceListItemRow.vue`, `OrderPriceListItemRow.vue` each
  render their own row; all three need the thumbnail and a broken-image fallback.
- Open decision: whether `PriceListFormPage.vue` should author `imageUrl`. The API contract already
  accepts it on create/update; only the form payload omits it.
- No image has been uploaded for any row yet; every cell in Q is blank.

## Gotchas

- `/api/price-list` is cached one hour and persisted to `localStorage`; a sheet edit is not visible
  on reload until the entry expires.
- The picker selection projections drop unknown row fields, so the image never reaches a created
  invoice line or order item. That is fine for a picker thumbnail.
