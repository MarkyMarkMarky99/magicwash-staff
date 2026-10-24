# Plan — Intake Order save → AI classification → review → Approve

Status: **not started.** Agreed with the owner 2026-10-24. Builds on the Intake Order page
(`docs/features/orders/order-intake-form.md`, branch `feat/order-intake-page`). MagicwashAI side is
done and live (MagicwashAI `7538d51`, `docs/plans/classify-laundry-items.md` "Order trigger").

## Why

Staff take in an order on the Intake Order page and photograph each garment with its tag.
MagicwashAI types the garments; staff check a proposed list of order items and approve once. This is a
step toward `laundry-item-registration.md`; LaundryPhotos will be dropped later.

**Backward compatible:** new endpoints and new pages only. Order detail, the edit form, the old Approve
button, the corporate form and status updates behave exactly as now. Intake orders still write
LaundryPhotos, so the old pages and job-ticket provisioning see their garments. The old page is
removed only once the new flow has proven itself.

## Flow

1. **Intake Order page** (exists): staff fill in the order and photograph garments with tags, plus
   document, weight and customer assets. Everything stays in the page.
2. **Save**: the page uploads garment photos to Firebase, then sends the order and all garments in
   **one request**. The backend creates the order as `RECEIVED`, writes the garment rows, and, if any
   garment has no type, triggers MagicwashAI with `{ orderIds: [orderId] }`. The page then uploads the
   other photos with the existing order-image API and opens the review page.
3. MagicwashAI classifies the whole LaundryItems sheet, writes `itemId`, then sets the order
   `SUBMITTED` (only if still `RECEIVED`). If every garment was already typed, the backend sets
   `SUBMITTED` at save.
4. **Review page** (new): garments grouped by type into proposed order items. Nothing is saved. Staff
   move garments between items, add an item, remove an empty item.
5. **Approve**: one request sends the list; the backend writes order items and garment links, then
   approves (job tickets as today).

## Decisions

Owner:

1. New, separate pages; existing order pages are not changed. Removed later.
2. `AI_SERVICE_KEY` makes the caller a logged-in staff member named AI.
3. One MagicwashAI classify task; it never filters by order. Its only job is typing garments.
4. No order items at intake.
5. The backend never creates order items on its own. The review page proposes them; staff edit them
   like a form; Approve sends them in one request.

Claude (minor):

6. The key replaces Firebase auth on every `staff` route with actor
   `{ staffId: 'AI', name: 'AI', email: '', role: 'staff' }`; admin-only routes stay closed. The old
   `itemId`-only body restriction is removed.
7. Save is one backend request; the intake order is born `RECEIVED` (garments are already counted and
   photographed). There is no separate Received button.
8. Garment photos upload to Firebase **the moment they are captured** (owner, 2026-10-24), as order
   detail's registration already does in the background (`uploadLaundryPhoto` needs no order). Removing
   a photo in the form, or Discard, deletes its file from Firebase. A closed tab leaves orphan files;
   accepted. Document, weight and customer-asset photos upload at capture too, so Save sends
   everything in one request (see "Save request").
9. New server env `MAGICWASH_AI_URL` (Production + Preview) = `https://ai.magicwash-laundry.com`.
   `AI_GATEWAY_SECRET` is already set.
10. Order item quantity = garments in it; price null (as today's manual add).
11. Moving a garment to an item of another type corrects its `LaundryItems.item_id` on Approve.
12. The review page handles orders with garments and **no order items**. An order that has items
    (made on the old page) opens read-only with a link to order detail, so the old page always wins.
13. The review draft lives in the page; a reload rebuilds it from the garments.

## Save request — the contract between the Intake page and the backend

Every photo of every category uploads to Firebase when it is captured, so at Save the page holds only
URLs and sends **one request** with everything. No upload happens after Save.

- Garment photos: `uploadLaundryPhoto` (folder `images`), as order detail does.
- Document, weight, customer-asset photos: folder `order-images/intake/<draftId>` (the order id does
  not exist yet; the folder name is only for tidiness, nothing reads it).
- Upload state per photo in the draft: `uploading` / `done` (URL) / `failed` (retry button).
  Save is disabled while any photo is `uploading` or `failed`.
- Removing a photo, or Discard, deletes its Firebase file (`deleteFromStorage`, new); delete errors are
  ignored.

`POST /api/order-intakes`, schema in `contracts/order-intakes/order-intake-api.schema.ts`:

```
{
  customerId:   string
  receivedDate: 'YYYY-MM-DD'
  dueDate:      'YYYY-MM-DD'
  serviceType:  'WSIR' | 'IRON' | 'DRCL' | 'WASH'
  orderName:    string | null
  note:         string | null
  garments: [ { tag: string (garment-tag format), imageUrl: string } ]          // 1 or more
  images:   [ { imageType: 'DOCUMENT' | 'WEIGHT' | 'BELONGING',
                imageUrl: string, quantity: number | null } ]                    // quantity = kg for WEIGHT
}
```

- Not sent: `createdBy` (session actor), `quantity` (server: `garments.length`), `status` (server:
  `RECEIVED`).
- Rejected before any write: bad field, duplicate tag in `garments`, a tag registered to another
  customer (409 with `conflictingTags`), a URL that is not a Firebase Storage URL of this project.

What the backend writes from it:

| sheet | rows |
|---|---|
| OrderForm | 1 order, `RECEIVED`, quantity = garments |
| LaundryPhotos | 1 per garment (transitional, for old pages and ticket provisioning) |
| LaundryItems | 1 per **new** tag |
| LaundryItemPhotos | `REGISTRATION` per new tag + `BEFORE` per garment |
| OrderGarments | 1 per garment, `RECEIVED` |
| OrderImages | 1 per entry in `images` |

Response `201`:

```
{
  orderId: string
  status: 'RECEIVED' | 'SUBMITTED'
  next: 'ai' | 'submitted' | 'none'          // none = AI could not be started
  failed: string[]                            // writes that did not land after the order existed
}
```

After `201` the page opens the review page, even when `failed` is not empty (it lists them).

## Design — backend

### Gateway — `server/shared/http/api-gateway.ts`

Replace `hasLaundryItemServiceKey` with `hasAiServiceKey(req)`: timing-safe compare of `x-service-key`
with `AI_SERVICE_KEY` (empty env = off). On any `staff` route, a match skips Firebase and uses the AI
actor; a wrong or missing key falls through to normal auth.

### `POST /api/order-intakes`

Body and response: see "Save request". `createdBy` from the session; `quantity` = garment count.

1. Validate before any write: header; every tag passes the garment-tag format; no duplicate tags in the
   request; no tag registered in LaundryItems to **another customer** (this check is now possible because
   the server reads LaundryItems). A conflict rejects the whole request with the conflicting tags, so
   staff fix them on the page.
2. Create the order with the existing work-order create path, no items, then set it `RECEIVED`.
3. `batchAppend` in this order:
   - LaundryPhotos: one per garment (`orderId`, tag as `itemId`, `imageUrl`, `orderItemId` null) —
     transitional, keeps old pages and ticket provisioning working;
   - LaundryItems: new tags only (`id` = tag, `customer_id`, `item_id` null, `image_url`);
   - LaundryItemPhotos: `REGISTRATION` (`order_id` null) for new tags, `BEFORE` (`order_id` = order)
     for every tag, same URL;
   - OrderGarments: one per garment (`status` `RECEIVED`, `orderitem_id` null);
   - OrderImages: one per `images` entry (`imageType`, `imagePath` = URL, `quantity`, `customerId`).
4. Next step, from the garments only:
   - some garment untyped → `POST {MAGICWASH_AI_URL}/tasks/classify-laundry-items` with
     `Authorization: Bearer <AI_GATEWAY_SECRET>`, `X-Acting-Staff-Id: <staff>`,
     `{ "input": { "orderIds": [orderId] } }`, 15 s timeout, awaited (202 comes back quickly);
   - all typed (returning customers' tagged garments) → set `SUBMITTED`.

Writes after the order exists are sequential and not atomic (existing precedent); what did not land
goes in `failed`. A trigger failure gives `next: 'none'`; the order stays `RECEIVED` and staff can
still review by hand.

### `GET /api/order-intakes/:orderId`

For the review page, one request: the order header and status, its non-deleted OrderGarments joined
with LaundryItems (`tag`, `itemId`, `imageUrl`), and whether the order already has order items.

### `POST /api/order-intakes/:orderId/approve`

Body `{ items: [{ itemId, tags: string[] }] }`, actor from the session:

1. Validate: order is `RECEIVED` or `SUBMITTED` with no order items; every non-deleted OrderGarments tag
   appears exactly once; every `itemId` exists in Items; no empty item.
2. `batchAppend` OrderItems `{ orderId, itemId, quantity: tags.length, price: null }` (service type from
   the order). Update the order's `quantity` to the garment total if it differs.
3. Update OrderGarments `orderitem_id`; update `LaundryItems.item_id` where the type changed; move the
   garments' LaundryPhotos into their OrderItem (transitional, one function).
4. Set `APPROVED` through the existing update path, so ticket provisioning runs unchanged.

A second Approve fails step 1 (order items exist), so a double tap cannot duplicate.

## Design — frontend

### Intake Order page — Save rewired

Capture and remove (all four categories):

- A composable `useIntakePhotoUploads` owns uploads: start on capture, keep `uploading` / `done` /
  `failed` per photo, retry, delete. The camera components stay unchanged (they only emit files); order
  detail keeps its own code until it is removed.
- New `deleteFromStorage(url)` in `src/shared/api/firebase-storage.ts` (`deleteObject` on the URL's
  ref). Removing an uploaded photo deletes its file; Discard deletes every uploaded file of the draft.
  A delete failure is ignored (orphan file, harmless).
- Firebase Storage rules are not in this repo; whether a signed-in staff member may delete is checked in
  the browser test. If denied, the owner enables delete in the Firebase console.

Replace the temporary save in `OrderIntakePage.vue`:

1. Save is disabled while any photo is `uploading` or `failed`, or there is no garment.
2. `POST /api/order-intakes` with the draft and URLs. 409 → notice naming the conflicting tags; staff
   remove or re-scan them.
3. `201` → replace the route with the review page; a non-empty `failed` is shown there.

The info strip under the Items paper keeps its message (AI sorts garments after save).

### Review page — new

Route `/orders/:orderId/intake-review`, full-screen with the same shell as the Intake Order page
(header card read-only, Items paper, footer with **Approve**).

- `RECEIVED`: a note that AI is sorting; the page refreshes itself every 15 s and has a refresh button.
  Staff may still sort by hand if AI is down.
- `SUBMITTED` (or by hand at `RECEIVED`): proposed items, one per `itemId`, quantity = garment count,
  each garment a photo tile with its tag; an **Unassigned** group for untyped garments.
- Move a garment (tap tile → choose item), add an item (price-list picker), remove an empty item.
- **Approve** is enabled when Unassigned is empty.
- Order has items, or is `APPROVED`/`COMPLETED`/`CANCELLED`: read-only with a link to order detail.

## Open point

- **Finding an intake order later.** Save opens the review page, but staff who leave need a way back.
  Options: one small "Review garments" link on order detail shown only for orders with OrderGarments
  and no items, or a list of orders waiting for review. Claude recommends the link.

## Risks

- GViz may not show new LaundryItems rows the moment MagicwashAI reads them; those garments show in
  Unassigned. To be measured in the live test.
- Raw BEF photos were never measured for accuracy; staff review catches mistakes.
- A queued trigger is lost if the MagicwashAI container restarts mid-run; staff sort by hand.
- Garment files of a tab closed before Save stay in Firebase unused (harmless). A cleanup job that
  deletes files no sheet references is possible later.

## Out of scope

- Any change to order detail, the edit form, the old Approve, or the corporate form.
- Registration page, order scan flow, `OrderGarments.status` writes from job tickets.

## Work items

| item | estimate |
|---|---|
| gateway: AI key = staff actor + tests + operations.md | ½ day |
| `POST /api/order-intakes`: validation, writes, MagicwashAI trigger, env + tests | 1 day |
| `GET /api/order-intakes/:orderId` + approve endpoint + tests | 1 day |
| Intake Order page: Save rewired | ½ day |
| review page | 1½ days |
| live test with a real test order | ½ day |
