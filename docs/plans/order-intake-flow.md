# Plan — Intake Order: scan registered garments, items grouped live

Status: **backend and Save wiring implemented; local dry verification complete; live test pending.** Rewritten with the owner
2026-10-24, open points answered 2026-10-25. Builds on the Intake Order page
(`docs/features/orders/order-intake-form.md`), the LaundryItems registration service
(`laundry-item-registration.md`) and the garment detail page, all on branch `feat/order-intake-page`.

## Why

Every garment is registered once (tag, `REGISTRATION` photo, type from MagicwashAI) on the Register
Garments page. Taking in an order is then only scanning tags, and the order items follow from the
garments' types while staff scan.

**Backward compatible:** new endpoint and the existing new page only. Order detail, the edit form,
the old Approve button, the corporate form and status updates behave as now. Ticket provisioning
reads OrderGarments for an order that has them and falls back to LaundryPhotos otherwise, so orders
from the old pages are provisioned exactly as today. Intake orders write no LaundryPhotos, so pages
that count garments from LaundryPhotos do not see their garments (accepted by the owner).

## Flow

1. **Intake Order page**: staff fill in the order and **scan each garment's tag**. No photo per
   garment. CCTV records the unpacking. A tag that is not registered is blocked: staff register it on
   Register Garments first.
2. Each scan adds the garment to the Items paper at once: one row per `LaundryItems.item_id`, quantity
   = garments in it. A garment with no type (AI not done or failed) goes to the **Uncategorized** row.
3. Each scan shows a scan card; for an Uncategorized garment it offers Choose type. Tapping a row
   opens a bottom sheet of its garments as photos; tapping a photo opens the garment detail page.
4. **Save**: one request with the order and its items. The backend writes everything and approves the
   order in the same request: the order ends `APPROVED` with its job tickets created.

Intake calls no MagicwashAI. The order statuses `SUBMITTED` and `RECEIVED` are not used by this flow.

## Decisions

Owner:

1. New, separate pages; existing order pages are not changed. Removed later.
2. Intake calls no MagicwashAI and no AI changes order status (2026-10-24).
3. No `BEFORE` photo per order. CCTV covers the unpacking (2026-10-24).
4. The Intake page shows order items while scanning, grouped by the garments' `item_id`; untyped
   garments gather in an Uncategorized row; tapping a row opens a bottom sheet of its garments
   (2026-10-24).
5. The backend never invents order items: it writes exactly the items the page sends.
6. Intake does not change a garment's registered type; that belongs to Register Garments and the
   garment detail page. Intake only lets staff choose a type for an untyped garment (2026-10-24).
7. A tag that is not registered is blocked at intake; staff register it first (2026-10-25).
8. Ticket provisioning and Tagging credit read OrderGarments (2026-10-25).
9. Save approves at once: the order ends `APPROVED` and job tickets are created (2026-10-25).
10. No defect photos in this round; the scan card, row sheet and Save carry none (2026-10-25).
10a. No weight photos at intake: bags are weighed on the Packaging page, and a `WEIGHT` image means
    a packed bag to delivery tracking, order total weight and ticket provisioning (2026-10-25).

Claude (minor):

11. Save is one backend request. It does not call the work-order `PATCH` approve path, because that
    path re-reads OrderForm, OrderItems and the garments through GViz right after they were written
    (fresh rows may not show yet, so no tickets) and costs extra calls. Instead the ticket-building
    step of `WorkOrderService.update` is moved into one shared function that takes the order, lines
    and garments as arguments; the approve path calls it after its reads, the intake endpoint calls
    it with the rows it already holds in memory. No second copy of the approve logic. The order is
    written `PENDING` and set to `APPROVED` only after its tickets are written (see Sheets call
    budget).
12. Provisioning: when the order has non-deleted OrderGarments rows, the garments come from them:
    `laundry_item_id`, service type and instructions from the `orderitem_id` line, `taggedBy` =
    `created_by` (the staff who saved the intake, if active), photo evidence = the garment's
    `LaundryItems.image_url`. With no OrderGarments rows, LaundryPhotos is read exactly as today.
13. Save is disabled while Uncategorized has garments, while a photo is `uploading` or `failed`, or
    with no garment. Every saved garment therefore has a type.
14. A type chosen on the page for an untyped garment is written to `LaundryItems.item_id` at Save.
15. Order item quantity = garments in it; price null (as today's manual add); service type from the
    order.
16. Document and customer-asset photos upload to Firebase when captured, through the shared
    `useGarmentPhotoUploads`. Removing a photo, or Discard, deletes its file; errors ignored.
17. MagicwashAI's order trigger (`orderIds` to `SUBMITTED`) is unused and left in place.

## Intake page

### Scanning

On each scan the page checks the tag format and duplicates in the draft, then
`GET /api/laundry-items/:id`:

- same customer → added under its type row (`itemId`), or Uncategorized when `itemId` is null;
- another customer → blocked with a notice;
- not found → blocked: "register it on Register Garments first".

The type name and row thumbnail come from the price-list Items catalog the page already loads for the
picker.

### Items paper

- One row per type: item name, quantity (garment count). Rows sorted by name; **Uncategorized** last,
  styled as a warning, shown only when it has garments. Total = all garments.

### Row bottom sheet

- Same look as the Packing bag sheet, without selection: title = the row's item name (or
  Uncategorized) and count, then a 3-column grid of registration photos (no caption).
- Tapping a garment opens the garment detail page as a route-owned overlay; the draft survives. There
  is no per-garment note or remove on the page yet.

## Save request

`POST /api/order-intakes`, schema in `contracts/order-intakes/order-intake-api.schema.ts`:

```
{
  customerId:   string
  receivedDate: 'YYYY-MM-DD'
  dueDate:      'YYYY-MM-DD'
  serviceType:  'WSIR' | 'IRON' | 'DRCL' | 'WASH'
  orderName:    string | null
  note:         string | null
  items: [ { itemId: string, tags: string[] } ]        // one per row, 1 or more; every tag once
  images: [ { imageType: 'DOCUMENT' | 'BELONGING', imageUrl: string } ]
}
```

- Not sent: `createdBy` (session actor), quantities (server: tag counts), `status`.
- Rejected before any write: bad field; a tag in more than one item or twice in one; an unknown
  `itemId`; an empty item; a tag registered to another customer (409 `conflictingTags`); a tag not
  registered (400 `unregisteredTags`); a URL that is not a Firebase Storage URL of this project.

What the backend writes, in order:

| step | sheet | rows |
|---|---|---|
| 1 | LaundryItems `item_id` | garments that had no type and got one on the page |
| 2 | OrderForm | 1 order, `PENDING`, quantity = garments |
| 3 | OrderItemForms | 1 per item: `itemId`, quantity = tags, price null |
| 4 | OrderGarments | 1 per garment: `RECEIVED`, `orderitem_id`, `created_by` = actor |
| 5 | OrderImages | 1 per entry in `images` |
| 6 | JobTickets | tickets built from the rows of steps 2–4 in memory |
| 7 | WorkTransactions | Tagging earn rows for those tickets |
| 8 | OrderForm `status` | `APPROVED` |

Writes are sequential and not atomic (existing precedent). A failure at step 2 writes nothing more
and returns an error. A failure at step 3 or 4 stops the run: the order stays `PENDING` and `failed`
names what is missing. A failure at step 5 or 7 is listed in `failed` and the run goes on. A
failure at step 6 skips steps 7–8: the order stays `PENDING` with its garments written, and staff
approve it with the existing Approve on order detail (which now reads OrderGarments and skips
tickets that already exist). A failure at step 8 returns `PENDING` with `OrderForm status` in `failed`; the tickets
already exist and the existing Approve skips them.

Response `201`: `{ orderId, status: 'APPROVED' | 'PENDING', ticketsCreated: number, failed: string[] }`.
The page replaces the route with order detail only for `APPROVED` with empty `failed`. Otherwise
it stays on intake with Save disabled and a footer notice naming the order, status and failures.

## Sheets call budget

The whole app shares one service account, so every Sheets API call of every page counts against
the same per-minute quota (Google default: 60 read and 60 write requests per minute per user; check
the project's quota page). Sheets API requests are not retried on HTTP 429. GViz reads do not use
the Sheets API quota.

Rules for this endpoint:

- Every multi-row write is one batch request (`batchAppend` / `updateMany`), never a loop of
  single-row calls.
- Nothing written in the request is read back through GViz; later steps use the rows in memory.
- No duplicate-ticket read for a new order: its ID did not exist before step 2.
- A dry-test runs the endpoint against counting fake repositories and asserts the exact numbers
  below, so a later change that adds a call fails the test.

Per Save:

| sheet | call | API | count |
|---|---|---|---|
| LaundryItems | read the customer's garments (tag owner, registered, type) | GViz | 1 |
| Items | check every `itemId` exists | GViz | 1 |
| WorkRates | rates for Tagging | GViz | 0–1 (cached after first load) |
| Staff | active staff for `taggedBy` | Sheets API read | 0–1 (cached 60 s) |
| LaundryItems | `updateMany` of chosen types: row lookup + write + readback | Sheets API | 0 or 2 reads + 1 write |
| OrderForm | append the order | Sheets API write | 1 |
| OrderItemForms | append all lines | Sheets API write | 1 |
| OrderGarments | append all garments | Sheets API write | 1 |
| OrderImages | append all images | Sheets API write | 0–1 |
| JobTickets | append all tickets | Sheets API write | 1 |
| WorkTransactions | append all earn rows | Sheets API write | 0–1 |
| OrderForm | status to `APPROVED`: row lookup + write + readback | Sheets API | 2 reads + 1 write |

Total per Save: **2–3 GViz reads, 2–5 Sheets API reads, 5–8 Sheets API writes**, the same for 5 or
50 garments. A cold server instance adds one header read per sheet on its first write (up to 8,
once). For comparison, the approve path alone today costs 4 GViz reads, 3 Sheets API reads and 3
writes.

Intake page, before Save: 3 GViz reads on load (Customers, Items, the customer's LaundryItems) and 0
per scan when the tag is in that list (1 GViz read otherwise). Photos go to Firebase, not Sheets.

## Risks

- A customer's first visit has many unregistered garments; staff must register them on Register
  Garments before intake. That is the price of registering once.
- Pages that read garments from LaundryPhotos (order detail counts, photo library) show none for an
  intake order.
- A type AI wrote after registration may not show at once (GViz lag); the garment shows in
  Uncategorized and staff pick the type.
- Files of a tab closed before Save stay in Firebase unused (harmless).
- Firebase Storage rules are not in this repo; delete permission is checked in the browser test.

## Out of scope

- Any change to order detail, the edit form, the old Approve, or the corporate form.
- A garment already in another open order (needs an OrderGarments check across orders; later).
- `OrderGarments.status` writes from job tickets; job tickets per garment.

## Work items

| item | status |
|---|---|
| frontend: remove defect and weight photos from the Intake page | Done |
| provisioning reads OrderGarments with LaundryPhotos fallback, tests | Done |
| `POST /api/order-intakes`: validation, writes, approve, tests | Done |
| upload at capture + Save rewired | Done |
| exact Save call-budget dry tests for 3 items / 10 and 50 garments / 2 images | Done |
| live test with a real test order | Pending; not run in this task (no live Sheets calls) |
