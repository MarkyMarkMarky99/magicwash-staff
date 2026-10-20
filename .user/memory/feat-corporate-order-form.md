# feat/corporate-order-form

- Corporate new-order page at `/orders/new/corporate/:customerId`; Save creates a real order via the normal `orderStore.create` with nested items + DOCUMENT slip photos. Spec: `docs/features/orders/corporate-order-form.md`.
- CRYO list is live: 22 PriceList rows (`price_group=CRYO`, WASH, price 0, active), matching Items rows, SVG icons as `image_url`, `PriceGroup=CRYO` on the 4 Cryo customers.
- White bathrobe is ITM-0117 because Items ITM-0099 is a leftover inactive "ZZ TEST" row.
- Slip-photo upload on Save not yet tried in a real browser (test order had no photos).
- Registry `PriceList.json` still says price-0 rows stay inactive; CRYO rows break that on purpose (no per-item price), owner to update the description.
- Nav "รีเฟรชข้อมูล" did not refresh the persisted customers/price-list/items cache on 3001; needed a manual localStorage clear.
- Icon sources live in `.user/cryo-icons/` (untracked).
- Known gaps vs prototype: no hold-to-repeat on +/−, no Change customer button, inline notice instead of toast.
