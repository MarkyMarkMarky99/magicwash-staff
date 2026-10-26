# Live test on the test customer (2026-10-27)

App: http://localhost:3000 (vercel dev, already running; never stop it or its vite child).
Customer for every write: test customer `cbcc555a` (index KLX, "ทดสอบ แก้แล้ว"). No other customer
may be written to. Gun helper: `.user/scan-prefix-test/plan.md` (re-inject after full loads, blur
the focused element before each scan).

## Hard rules

- Never print: no Print / Print tags / bag-tag control, no Packaging confirm, no weighing.
- Writes only in the steps below, only for customer `cbcc555a`.
- Do not press Start / Complete on department pages.
- Record every id written.

## Part R — Register Garments Save

Page `#/customers/cbcc555a/garments/register`.
R1. Register three garments with made-up tags. For each: scan `MWG-TEST0001`, `MWG-TEST0002`,
    `MWG-TEST0003` (one at a time), take its photo with the camera, confirm.
R2. Save. Record the result message (registered / already registered / failed counts) and where
    the page goes.
R3. Scan `MWG-TEST0001` again on the register page: record the message (expected: already
    registered / duplicate).

## Part I — Intake Save

Page `#/orders/new/intake/cbcc555a`.
I1. Scan `MWG-TEST0001`, `MWG-TEST0002`, `MWG-TEST0003`. Record each popup. Garments without a
    type land in Uncategorized: choose any reasonable type for each and record it.
I2. Scan `MWG-QruY68yk` (a garment of another customer): record the message (expected: refused,
    not added).
I3. Scan `MWG-TEST0009` (never registered): record the message (expected: refused).
I4. Add 1 Document photo.
I5. Save. Expected: the page goes to the new order's detail page by itself. Record the URL, the
    order id, the status, and the item lines shown (each should show an item name, not
    "No description").

## Part G — Garment detail from scan

I'm on `#/orders`. Scan `MWG-TEST0001`.
G1. The garment overlay opens; record the time until the garment shows and until Order history
    shows; the history should list the order from I5.
G2. Back closes it.

## Report

Per step PASS / FAIL with what you saw, every id written, zoomed screenshots of failures,
console errors, anything not done and why.
