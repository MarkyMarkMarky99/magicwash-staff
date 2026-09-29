# feat/invoice-form-overlay

- Invoice create page moved from `AppLayout` page into `FormOverlay` (eyebrow, customer title, submit in footer).
- Line items split into `InvoiceLineCard.vue` (swipe-to-remove card, quantity stepper, collapsible adjustments).
- `InvoiceTotalsPreview` restyled as a dark primary card; subtotal row shows only when adjustments change the total.
- Committed as WIP 2026-09-29; typecheck:web passes; not browser-verified.
- Next: browser-check the overlay, line cards, swipe remove, stepper, and all six result states.
