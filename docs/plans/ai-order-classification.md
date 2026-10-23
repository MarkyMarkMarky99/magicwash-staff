# Plan — garment intake form + AI classification

Status: **not started.** Agreed with the owner 2026-10-23.

## Why

Today staff create the order, open it, photograph garments one by one, create every order item by
hand, then move each photo into its item. A new, separate intake form captures the garments while
the order is being created, and MagicwashAI fills in what staff leave unclassified.

## Flow

1. Staff open the **new intake form** (separate from `/orders/new`, which stays as it is).
2. Staff fill in the order header and print tags from the form.
3. Staff photograph each garment while scanning its tag, inside the form. Each photo uploads to
   Firebase immediately, exactly as today; the form keeps the URL.
4. Optionally, staff tap a photo and classify it to an Items entry. Unclassified photos wait for AI.
5. Staff save. **One request** creates the Order, its LaundryPhotos, and the LaundryItems for new
   tags.
6. The backend hands the order to MagicwashAI. MagicwashAI classifies only the garments that have no
   type yet, then creates OrderItems, moves photos into items, and sets `SUBMITTED`.
7. Staff review in the photo library and press **Approve**. Unchanged — approval still provisions
   job tickets.

## Decisions

Owner decisions:

1. **A new, separate intake form** for this flow. The existing create form and its flow stay.
2. **One save request** creates Order + LaundryPhotos + LaundryItems. Firebase upload stays in the
   browser; the request carries the URLs.
3. **Photo capture lives inside the form.**
4. **Staff may classify any photo in the form, or leave it for AI.**
5. **AI never re-classifies a garment that already has a type** — a permanent tag already in
   LaundryItems with an `itemId`, or one staff classified in the form.
6. **`SUBMITTED` means "order form created, awaiting check"**, its original meaning. MagicwashAI sets
   it when it finishes. `APPROVED` stays "order verified correct".
7. **AI runs once per order.**
8. **The backend triggers MagicwashAI**, not the browser.
9. **MagicwashAI writes through webapp APIs with a service key.** No direct Sheets writes, no staff
   Firebase token.
10. **AI writes are recorded under a fixed AI actor**, not a staff ID.
11. **Staff approve by hand.** AI never sets `APPROVED`.

Claude decisions (stated to the owner, not objected to):

12. **OrderItems price is null**, as the corporate order form already does.
13. **MagicwashAI reads order data through webapp APIs** with the service key, not GViz, so column
    mapping lives in one place.
14. **A garment AI cannot classify stays unassigned.** No OrderItem counts it and its photo is not
    moved; staff resolve it in review. The existing Approve quantity check blocks approval until then.
15. **OrderItems count every typed garment**, including permanent-tag and staff-classified ones. AI
    skips only the *classification* step for them, not the grouping.

## What exists today

- **Tag printing needs no order.** `POST /api/laundry-tag-prints` takes `customerIndex`,
  `totalCount`, and `{ sequence, tagId }[]`; no `orderId` (`contracts/laundry-tag-prints/laundry-tag-print.schema.ts:3`).
  Tag IDs are generated in the browser (`src/data/laundry-tag-prints/laundry-tag-print.service.ts:14`).
  The tag shows the QR, customer index, and `n/total` (`C:\MagicwashInvoice\server.js:285`).
- **Permanent tags = LaundryItems rows.** `id` is the tag, `itemId` the catalog type; same 8-char
  format as printed tags. Look up with `GET /api/laundry-items/:id`
  (`server/modules/laundry-items/laundry-item.module.ts:42`). Permanent tags recur across orders.
- **Reusable capture UI.** `GarmentRegistrationCamera.vue` does tag scan, manual entry, and photo;
  `garment-registration.ts` has `validGarmentTag`, `isDuplicateGarmentTag`, `canSaveGarment`. The save
  and duplicate-loading logic is page-local to `OrderDetailPage.vue:329-414`, bound to an existing
  order.
- **Field names collide.** `LaundryPhoto.itemId` is the garment tag; `OrderItem.itemId` and
  `LaundryItem.itemId` are the catalog type (`docs/features/orders/data-model.md:103`).
- **Multi-sheet writes are not atomic.** Work-order create appends the header, then items, and
  reports `itemsFailed` without rolling back (`server/modules/work-orders/work-order.service.ts:260`).
  Packaging confirm batch-appends several sheets in sequence with no rollback
  (`server/modules/packaging-bags/packaging-bag.service.ts:50`). Repositories offer `batchAppend` per
  sheet (`server/shared/repositories/sheet-repository.contract.ts:4`); services expose one-row
  `append` only.
- **Status.** Enum has `PENDING`, `RECEIVED`, `SUBMITTED`, `APPROVED`, `COMPLETED`, `CANCELLED`;
  `PATCH /api/work-orders/:id` sets any of them with no transition rules
  (`contracts/work-orders/work-order-api.schema.ts:8`). `APPROVED` provisions job tickets
  (`work-order.service.ts:351`).
- **Local-PC links exist.** Backend → print server with Cloudflare Access headers
  (`server/modules/laundry-tag-prints/laundry-tag-print-client.ts:74`); print server → webapp with
  `X-Print-Api-Key` (`C:\MagicwashInvoice\server.js:724`). MagicwashAI at
  `https://ai.magicwash-laundry.com` accepts `AI_GATEWAY_SECRET` + `X-Acting-Staff-Id`
  (`C:\MagicwashAI\src\auth.js:24`); its tasks run synchronously (`C:\MagicwashAI\server.js:109`).

## Design

### Intake form (frontend)

A new page beside `/orders/new` and `/orders/new/corporate/:customerId`, full-screen like
`CorporateOrderPage`.

- **Header:** customer, dates, service type, note — same fields as the existing create form.
- **Print tags:** from the form, using the existing print API with the customer's index.
- **Garment list:** reuse `GarmentRegistrationCamera`. On each scan:
  - reject a tag already captured in this form;
  - look the tag up in LaundryItems. Found with a type → mark it **permanent**, show its type,
    locked. Found under another customer → warn.
  - upload the photo to Firebase at once; keep the URL in the form.
- **Classify:** tapping a photo opens the Items picker; the choice is stored on that garment. A
  staff choice can be cleared again before save.
- **Save:** disabled while any upload is still running.

Form state lives in a composable for this page, not in `OrderDetailPage`.

### Save request (backend)

One new endpoint taking the header plus `garments: { tagId, imageUrl, itemId | null }[]`.

1. Validate everything first: header, tag format, no duplicate tags in the request, every `itemId`
   exists in Items.
2. Append the Order.
3. `batchAppend` LaundryPhotos (BEF): one per garment, `orderId`, tag, URL, staff actor.
4. `batchAppend` LaundryItems for **new tags only**: `id` = tag, `customerId`, `itemId` (staff choice
   or null), `imageUrl`. Permanent tags get no new row.
5. Trigger MagicwashAI (below).

Writes are sequential and not atomic, matching existing precedent. The response says which steps
landed, like `itemsFailed`. If photos or items fail after the order exists, staff finish that order
in the existing order-detail flow; the client does not blind-retry (uncertain writes may have
landed).

### Trigger (backend)

At the end of the save request, call MagicwashAI `POST /tasks/classify-order` with `{ orderId }`,
`Authorization: Bearer <AI_GATEWAY_SECRET>`, `X-Acting-Staff-Id: <staff>`. Short timeout;
MagicwashAI only acknowledges. A failed call does not undo the save; the response reports it and
staff continue by hand.

New server env vars: MagicwashAI base URL and `AI_GATEWAY_SECRET` (server-side, not `VITE_`).

### `classify-order` task (MagicwashAI)

Acknowledges immediately, then runs in the background — unlike existing tasks, which the route
awaits.

1. Read the order, its BEF LaundryPhotos, their LaundryItems, and the Items catalog through webapp
   GET APIs.
2. Stop if the order already has OrderItems or is past `RECEIVED`/`PENDING`.
3. Classify **only** garments whose LaundryItem has no `itemId`. Result per garment: one `Items.id`
   or "unsure".
4. `PATCH` each newly classified LaundryItem's `itemId`.
5. Group all typed garments by `itemId`; create one OrderItem per group (`quantity` = count,
   `price` null).
6. Reassign each typed garment's photo to its OrderItem.
7. Set the order to `SUBMITTED`.

If any write fails, stop and leave the order as it is; staff finish by hand. No automatic retry.

### Service key (backend)

A service credential accepted alongside staff auth, only where MagicwashAI needs it:

- read: work order, LaundryPhotos by order, LaundryItems, Items
- write: `PATCH /api/laundry-items/:id`, `POST /api/order-items`, `POST /api/laundry-photos/reassign`,
  `PATCH /api/work-orders/:id` limited to setting `SUBMITTED`

Writes under the service key record the fixed AI actor in `createdBy`/`updatedBy`. Follow the print
server's `X-Print-Api-Key` pattern for checking the key.

### Review (frontend)

Staff review in the existing photo library. One change: moving a photo to another item also updates
that garment's `LaundryItems.item_id` to the target item's `itemId`.

## Open points

- **Order status at save.** Does the intake form save the order as `RECEIVED` (photos are done, so
  the garments are received), or as `PENDING`? Claude's recommendation: `RECEIVED`.
- **AI on the old flow.** Should the old flow's first `PENDING → RECEIVED` also trigger AI, or only
  intake-form orders?
- **AI actor side effects.** Confirm nothing resolves staff from OrderItems `createdBy` (job tickets,
  Tagging scores read LaundryPhotos, which staff still create).
- **Cloudflare Access on `ai.magicwash-laundry.com`.** If the hostname is behind Access, the backend
  call needs Access headers like the print clients.
- **Classification input** (which Items fields and images the prompt uses) is MagicwashAI's design.

## Out of scope

- Prices on OrderItems.
- AFT photos, order-images (WEIGHT/DOCUMENT/BELONGING).
- Auto-approve.
- Changes to the existing create form or order-detail registration flow.
- A standalone LaundryItems management page.

## Work items

| repo | item | estimate |
|---|---|---|
| webapp-vue | intake form page + composable (capture, permanent-tag lookup, classify, print) | 1½ days |
| webapp-vue | save endpoint: Order + LaundryPhotos + LaundryItems, partial-failure report | 1 day |
| webapp-vue | service-key auth + AI actor on listed routes | ½ day |
| webapp-vue | MagicwashAI trigger + env vars | ½ day |
| webapp-vue | photo-library move updates `LaundryItems.item_id` | ½ day |
| MagicwashAI | `classify-order`: acknowledge-then-run, classify untyped, write back | 1 day |
