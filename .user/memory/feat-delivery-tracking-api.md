# feat/delivery-tracking-api

- Public `GET /api/delivery-tracking/:orderImageId`; page `/b/:id` uses it; fixtures deleted.
- Probed live: `574fdcaa` → bag 4 of 4, customer Marky, real Firebase photos; unknown id → 404.
- Temporary: `deliveredAt` = COMPLETED DELIVERY appointment's `UpdatedAt`; proof always null until Appointments gets DeliveredAt/proof columns.
- Next: owner checks the Preview URL on a phone; then merge to main.
