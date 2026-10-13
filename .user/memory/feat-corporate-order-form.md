# feat/corporate-order-form

- UI-only corporate new-order page at `/orders/new/corporate/:customerId`; Save shows "not connected" notice. Spec: `docs/features/orders/corporate-order-form.md`.
- Approved prototype (scratchpad, may be gone): `variant-c1a-scan.html` under the 2026-10-13 session scratchpad `corporate-order/`.
- Not browser-checked with real sign-in/data, real camera, or a phone; only a temporary harness with fake stores.
- No entry point yet: owner to choose where it launches (e.g. customer detail New Order for customers with `PriceGroup`).
- Sheet setup needed to try it: set `Customers.PriceGroup` and matching `PriceList.price_group` rows for a test company.
- Next round (needs design): save = create order (service type WASH) + batch order items + upload slip photos (OrderImages DOCUMENT?).
- Known gaps vs prototype: no hold-to-repeat on +/−, no Change customer button, inline notice instead of toast.
