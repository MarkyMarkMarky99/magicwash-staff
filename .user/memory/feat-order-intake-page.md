# Branch `feat/order-intake-page`

New full-screen order intake page (`/orders/new/intake/:customerId`), entry "Intake Order" in the customer order-history create menu. Canonical doc: `docs/features/orders/order-intake-form.md`. Prototype: `.user/intake-form-design/variant-a.html`.

## Status
- Built from prototype A; header/footer/Items paper follow the corporate form.
- Checked in the owner's Chrome on `localhost:3000`: header, order-details sheet, Items paper, camera menu (all four rows), garment camera, document scanner, weight prompt, belonging camera.

## Pending
- Capture + **Save order** never run end to end (would create a real order); test with a test customer, then delete the order and photos.
- Save is temporary: creates a `PENDING` order and uploads LaundryPhotos/order images with existing APIs. Next round = RECEIVED + MagicwashAI wiring per `docs/plans/received-ai-classification.md` (that plan is still uncommitted on `main`'s working tree).
- Garment tag duplicates are checked only inside the draft; a tag used on another order fails at save.
- Vite `scanic-ml` error overlay on `vercel dev` predates this branch (corporate form shows it too).
