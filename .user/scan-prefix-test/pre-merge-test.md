# Pre-merge browser test (2026-10-27)

App: http://localhost:3000 (vercel dev, already running; never stop it or its vite child).
Branch `feat/order-intake-page` at `b5a16ac6`. Customer for every write: Marky `a3e93305`
(the owner's own account; writes to real sheets are allowed for it only).

## Hard rules

- Never print: do not press any Print / Print tags / Reprint / bag-tag control, and do not confirm
  Packaging bags or weigh anything. The printer is in another place.
- Writes are allowed only in Part B and Part C, only for customer Marky, only the steps listed.
- Do not touch any other customer's order, ticket or appointment.
- Do not press Start / Complete on department pages.
- Record every write you make (order id, what was saved) in the report.

## Part A — read-only checks

A1. `#/appointments` (schedule): page loads; switch to tomorrow, then back to today, then one day
    last month (use the month arrows). Each day shows its appointments or an empty state without
    errors. Record whether a network request to `/api/appointments` is sent on each switch (expected:
    only one request in total since the page load).
A2. Pending appointments page (from the nav): loads; the nav badge count equals the number of rows.
A3. `#/staff`: list shows. Leave to `#/orders` and come back: record whether `/api/staff` is
    requested again (expected: no). Pull-to-refresh / the list refresh control: `/api/staff` is
    requested once.
A4. Console: no errors during A1–A3.

## Part B — Intake Save (writes; customer Marky)

Page `#/orders/new/intake/a3e93305`.
B1. Scan with the gun helper (see `.user/scan-prefix-test/plan.md`): `MWG-QruY68yk`,
    `MWG-7QQtHpoj`, `MWG-dZaBsip0`. The third has no type and lands in Uncategorized.
B2. Choose a type for the Uncategorized garment (any reasonable type, record which).
B3. Photos: add 1 Document photo and 1 Customer asset photo if the camera works in this browser.
    If the camera cannot capture, record that and save without photos.
B4. Save. Record: where the page goes, the order id, and the status shown on order detail.
B5. On order detail of the new order: record the garments/items shown and the order status.

## Part C — Approve on a normal order (writes; customer Marky)

C1. Create a normal (non-intake) order for Marky from the customer's order create menu with one
    item, minimal fields, note "TEST pre-merge". Save. Record its id and status (expected PENDING).
C2. On its order detail, press Approve (do not press any print control). Record the result
    message and the status after.

## Report

Per step PASS / FAIL with what you saw, ids of everything written, screenshots of failures
(zoomed), console errors, and anything you could not do and why.
