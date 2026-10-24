# Plan — Intake Order: scan registered garments, items grouped live

Status: **not started.** Rewritten with the owner 2026-10-24 (replaces the AI-at-intake plan
`received-ai-classification.md`). Builds on the Intake Order page
(`docs/features/orders/order-intake-form.md`) and the LaundryItems registration service
(`laundry-item-registration.md`), both on branch `feat/order-intake-page`.

## Why

Every garment is registered once (tag, `REGISTRATION` photo, type from MagicwashAI) on the Register
Garments page. Taking in an order is then only scanning tags, and the order items follow from the
garments' types while staff scan.

**Backward compatible:** new endpoint and the existing new page only. Order detail, the edit form,
the old Approve button, the corporate form and status updates behave exactly as now. Intake orders
still write LaundryPhotos, so old pages, ticket provisioning and Tagging credit see their garments.
The old pages are removed only once the new flow has proven itself.

## Flow

1. **Intake Order page** (exists, reworked): staff fill in the order and **scan each garment's tag**.
   No photo per garment. CCTV records the unpacking.
2. Each scan adds the garment to the Items paper at once: one row per `LaundryItems.item_id`, quantity
   = garments in it. A garment with no type (AI not done or failed) goes to the **Uncategorized** row.
3. Tapping a row opens a bottom sheet with the garments in it. There staff change a garment's type,
   add a note, or add a `DEFECT` photo.
4. **Save**: one request with the order, its items and its garments. The backend writes everything
   and the order becomes `RECEIVED` (open point 3).
5. Staff approve on order detail with the existing Approve button; job tickets as today.

Intake calls no MagicwashAI and nothing changes an order's status automatically. `SUBMITTED` is not
used by this flow.

## Decisions

Owner:

1. New, separate pages; existing order pages are not changed. Removed later.
2. Intake calls no MagicwashAI and no AI changes order status (2026-10-24).
3. No `BEFORE` photo per order. Only a garment with a problem is photographed (`DEFECT`). CCTV covers
   the unpacking (2026-10-24).
4. The Intake page shows order items while scanning, grouped by the garments' `item_id`; untyped
   garments gather in an Uncategorized row; tapping a row opens a bottom sheet of its garments
   (2026-10-24). This replaces the separate review page and the earlier "no order items at intake".
5. The backend never invents order items: it writes exactly the items the page sends.

Claude (minor):

6. Save is one backend request. The backend creates the order through the existing create path
   (always `PENDING`) and sets the status in the same request.
7. Save is disabled while Uncategorized has garments, while a photo is `uploading` or `failed`, or
   with no garment. Every saved garment therefore has a type.
8. A type chosen or changed on the page is written to `LaundryItems.item_id` at Save, so the garment's
   next order needs nothing.
9. Order item quantity = garments in it; price null (as today's manual add); service type from the
   order.
10. Photos (defect, document, weight, customer asset) upload to Firebase when captured, through the
    shared `useGarmentPhotoUploads`. Removing a photo, or Discard, deletes its file; errors ignored.
11. Each LaundryPhotos row uses the garment's registration image (`LaundryItems.image_url`), its order
    item id, and `created_by` = the staff who saved (keeps Tagging credit and order detail counts).
12. MagicwashAI's order trigger (`orderIds` → `SUBMITTED`, live since 2026-10-24) is unused and left in
    place. The gateway "AI key = staff" change is not needed.

## Open points (owner)

1. **A scanned tag that is not registered.** Recommended: register it on the Intake page (camera for
   the `REGISTRATION` photo; Save calls `register()` first, which also asks MagicwashAI to type it, as
   the registration page does; on this page it sits in Uncategorized until staff pick a type).
   Alternative: block it and send staff to Register Garments.
2. **Ticket provisioning source.** Recommended: keep writing LaundryPhotos for now (decision 11).
   Alternative: move provisioning and Tagging credit to OrderGarments (about 1 extra day; old pages then
   do not see intake garments).
3. **Status after Save.** Recommended: `RECEIVED`, then the existing Approve on order detail (a check
   step, no new approve code). Alternative: Save approves at once (`APPROVED`, tickets created; one tap
   fewer, no separate check).

The contract below assumes the recommended answers.

## Intake page

### Scanning

On each scan the page checks the tag format and duplicates in the draft, then
`GET /api/laundry-items/:id`:

- same customer → added under its type row (`itemId`), or Uncategorized when `itemId` is null;
- another customer → blocked with a notice;
- not found → open point 1.

The type name and row thumbnail come from the price-list Items catalog the page already loads for the
picker.

### Items paper

- One row per type: item name, quantity (garment count). Rows sorted by name; **Uncategorized** last,
  styled as a warning, shown only when it has garments. Total = all garments.
- The info strip says garments are grouped by their registered type and Uncategorized must be empty
  to save.

### Row bottom sheet

- Title: the row's item name (or Uncategorized) and count.
- One line per garment: registration photo, tag, defect badge, note.
- Per garment: **Change type** (price-list picker; the garment moves to that row, a new row if
  needed), **Note**, **Defect photo** (camera, several allowed), **Remove** from this order.
- A row whose last garment leaves disappears.

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
  items: [ { itemId: string, tags: string[] } ]        // one per row; every garment in exactly one
  garments: [ {
    tag:                  string (garment-tag format)
    note:                 string | null      // this round only: stain, missing button
    defectImageUrls:      string[]           // empty for most garments
    registrationImageUrl: string | null      // only for a tag registered on this page
  } ]                                         // 1 or more
  images: [ { imageType: 'DOCUMENT' | 'WEIGHT' | 'BELONGING',
              imageUrl: string, quantity: number | null } ]   // quantity = kg for WEIGHT
}
```

- Not sent: `createdBy` (session actor), `quantity` (server: garment count), `status`.
- Rejected before any write: bad field; duplicate tag; a tag in `garments` not in exactly one item
  (or the reverse); an unknown `itemId`; an empty item; a tag registered to another customer (409
  `conflictingTags`); a tag not registered and without `registrationImageUrl` (400
  `unregisteredTags`); a URL that is not a Firebase Storage URL of this project.

What the backend writes, in order:

| sheet | rows |
|---|---|
| LaundryItems + LaundryItemPhotos `REGISTRATION` | new tags only, through `register()` (with the chosen `itemId`) |
| LaundryItems `item_id` | registered garments whose type differs from the chosen one |
| OrderForm | 1 order, `PENDING` → `RECEIVED`, quantity = garments |
| OrderItems | 1 per item: `itemId`, quantity = tags, price null |
| LaundryPhotos | 1 per garment: registration image, its order item id (transitional) |
| OrderGarments | 1 per garment: `RECEIVED`, `notes`, `orderitem_id` |
| LaundryItemPhotos `DEFECT` | 1 per defect URL, `order_id`, garment note |
| OrderImages | 1 per entry in `images` |

Writes are sequential and not atomic (existing precedent); anything that did not land after the
order exists goes in `failed`.

Response `201`: `{ orderId, status: 'RECEIVED', failed: string[] }`. The page replaces the route with
order detail; a non-empty `failed` is shown there as a notice.

## Risks

- A customer's first visit has many unregistered garments; registering them at intake is slower than
  scanning. That is the price of registering once.
- A type AI wrote after registration may not show at once (GViz lag); the garment shows in
  Uncategorized and staff pick the type.
- Files of a tab closed before Save stay in Firebase unused (harmless).
- Firebase Storage rules are not in this repo; delete permission is checked in the browser test.

## Out of scope

- Any change to order detail, the edit form, the old Approve, or the corporate form.
- A garment already in another open order (needs an OrderGarments check across orders; later).
- `OrderGarments.status` writes from job tickets; job tickets per garment.

## Work items

| item | estimate |
|---|---|
| `POST /api/order-intakes`: validation, writes, tests | 1½ days |
| Intake page: scan-only garments, lookup, Items paper rows, Uncategorized | 1 day |
| row bottom sheet: change type, note, defect photo, remove | 1 day |
| upload at capture + Save rewired | ½ day |
| live test with a real test order | ½ day |
