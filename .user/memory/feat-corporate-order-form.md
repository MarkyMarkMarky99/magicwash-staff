# feat/corporate-order-form

- UI-only corporate new-order page at `/orders/new/corporate/:customerId`; Save shows "not connected" notice. Spec: `docs/features/orders/corporate-order-form.md`.
- Dates live in the customer card (calendar tile for due, received line); Order details section and Note removed by owner 2026-10-20.
- CRYO list is live: 22 PriceList rows (`price_group=CRYO`, WASH, price 0, active) and `PriceGroup=CRYO` on the 4 Cryo customers.
- Open decision: items show in item_code order, owner wants the Cryo form's order; proposed `display_order` column on PriceList, awaiting owner yes.
- Registry `PriceList.json` still says price-0 rows stay inactive; CRYO rows break that on purpose (no per-item price), owner to update the description.
- No entry point yet: owner to choose where it launches (e.g. customer detail New Order for customers with `PriceGroup`).
- Next round (needs design): save = create order (service type WASH) + batch order items + upload slip photos (OrderImages DOCUMENT?).
- Nav "รีเฟรชข้อมูล" did not refresh the persisted customers/price-list cache on 3001; needed a manual localStorage clear.
- Known gaps vs prototype: no hold-to-repeat on +/−, no Change customer button, inline notice instead of toast.
