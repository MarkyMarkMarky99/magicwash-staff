# feat/packaging-bag-page

- Status: UI-only round done; page runs on the fixture `packaging-bag-source.ts`, no backend calls.
- Route `/departments/packaging/:orderId`; prototype `.user/memory/designs/packaging-bag-page.html`; workflow `docs/features/packaging/workflow.md`.
- Matched against the prototype by screenshot collage (2026-10-09); left as-is by owner: tag id below the tile, sheet ~50px taller (DetailOverlay spacing).
- Open: keep the additive `closeButton` prop on shared `DetailOverlay`; sheet scan button uses `onDark` tone on a light sheet.

## Next (backend round)

- Decide bag photo upload timing (on capture vs on Confirm) and the Confirm partial-failure policy.
- One Confirm endpoint per order: OrderImages rows, BagItems, LOG-BAG tickets, complete Packaging ITEM tickets, then print.
- Print contract change in webapp-vue and C:\MagicwashInvoice together: item count, optional `weightKg`, `packedAt`.
- Replace the fixture with the order's real garments and ticket states.
