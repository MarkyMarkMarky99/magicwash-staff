# Plan — garment registration (LaundryItems as customer assets)

Status: **sheets registered; registration in progress.** OrderGarments and LaundryItemPhotos have
contracts and generic CRUD routes on `main` (deployed). The registration service and page are planned
below (branch `feat/laundry-item-registration`). Agreed with the owner 2026-10-23.

Supersedes, for now, the intake-form plan in `ai-order-classification.md` (paused).

## Why

Every garment a customer sends should exist as a registered, tagged, photographed asset before any
order touches it. Orders then only need a tag scan per garment, and each garment keeps a history
across orders.

## Data model

```
Order ── OrderItems (type + service lines, unchanged)
            └── OrderGarments (one row per garment per order) ── LaundryItems (the garment)
                                                                     └── LaundryItemPhotos (new; many per garment)
```

LaundryPhotos (BEF) and AfterPhotos are left untouched. Existing screens keep using them; everything
built from this plan reads and writes LaundryItemPhotos only.

### LaundryItems — exists, unchanged

`id` = tag, `customer_id`, `item_id` = garment type (Items catalog, nullable), `wash_program`,
`notes`, `image_url`, audit + soft-delete columns. Already has GET/POST/PATCH at
`/api/laundry-items` (`server/modules/laundry-items/laundry-item.module.ts`).

### OrderItems — unchanged

Stays as type + quantity lines. It is also built to carry a different service type per line. No
LaundryItems id goes on it.

### OrderGarments — new sheet

| column | null | meaning |
|---|---|---|
| `id` | no | row key |
| `order_id` | no | order the garment came in with |
| `laundry_item_id` | no | the garment's tag (= `LaundryItems.id`) |
| `orderitem_id` | yes | the OrderItems line it belongs to; filled when known |
| `notes` | yes | this round only — stain, missing button |
| `status` | no | the garment's current stage (below) |
| `created_at`, `created_by` | no | who scanned it in, when |
| `updated_at`, `updated_by` | yes | |
| `deleted_at`, `deleted_by` | yes | scanned into the wrong order |

Rule: one non-deleted row per `laundry_item_id` per order.

`status` values: `RECEIVED`, `WASHING`, `DRY_CLEANING`, `IRONING`, `PACKING`, `READY`, `DELIVERED`.
It is a copy of the garment's current stage. Job tickets stay the full record (who, when, each
department). Only the backend writes `status`, in the same request that changes the job ticket:

| event | status |
|---|---|
| garment scanned into the order | `RECEIVED` |
| a department ticket starts or becomes the next one due | that department's stage |
| Packaging ticket completes | `READY` |
| order set `COMPLETED` | `DELIVERED` |

The UI never writes `status` directly.

### LaundryItemPhotos — new sheet

Every photo of a garment, of every kind, in one sheet. The kind is a column, not a separate sheet.

| column | null | meaning |
|---|---|---|
| `id` | no | row key |
| `laundry_item_id` | no | the garment's tag (= `LaundryItems.id`) |
| `order_id` | yes | the order it was taken in; null for a registration photo taken before any order |
| `photo_type` | no | `REGISTRATION`, `BEFORE`, `AFTER`, `DEFECT` |
| `image_url` | no | Firebase URL |
| `notes` | yes | e.g. where the defect is |
| `created_at`, `created_by` | no | who took it, when |
| `updated_at`, `updated_by` | yes | type or note corrected |
| `deleted_at`, `deleted_by` | yes | wrong photo |

- Photos of a garment in one order = rows with its `laundry_item_id` and that `order_id`.
- All photos of a garment = rows with its `laundry_item_id`.
- `REGISTRATION` is the garment's first photo at registration; `order_id` stays null forever.
- `BEFORE` is the first photo of the garment in each order. For the garment's first order the
  backend writes a `BEFORE` row reusing the registration photo's URL (no second shot); later orders
  get their own `BEFORE` photo.
- New photo kinds are new `photo_type` values, never new sheets.

Old LaundryPhotos and AfterPhotos rows are not migrated: most lack a tag, so they cannot be joined to
a garment.

## Registration flow (branch `feat/laundry-item-registration`)

Cut from `feat/order-intake-page` (same round, 2026-10-24). The Intake Order save
(`received-ai-classification.md`) calls the registration service built here instead of writing
LaundryItems itself.

1. From the customer's Order History create menu, staff open **Register Garments**
   (`/customers/:customerId/garments/register`), a full-screen page like the Intake Order page.
2. Staff print disposable tags from the page (count input; the print API needs only the customer
   index), or use the garment's permanent tag.
3. For each garment: scan the tag, take a photo. The photo uploads to Firebase at capture; removing it
   or Discard deletes the file.
4. On each scan the page looks the tag up (`GET /api/laundry-items/:id`):
   - not found → added to the draft;
   - same customer → "already registered", not added;
   - another customer → blocked.
5. Save sends **one request** with all garments. The backend re-checks every tag, writes LaundryItems
   and `REGISTRATION` photos, then triggers MagicwashAI to type the new garments.

`LaundryItems.image_url` is the garment's cover image; LaundryItemPhotos holds the history. The AI
flat-cloth image that later replaces `image_url` for display is out of scope.

## Design — backend

### Registration service — `server/modules/laundry-items/laundry-item-registration.service.ts`

The only code that creates LaundryItems rows. Two functions, used by the register route here and
later by the Intake Order save:

- `checkTags(customerId, tags)` — read only. Reads LaundryItems once (whole sheet) and returns
  `{ new: string[], registered: string[], conflicts: string[] }` (`registered` = same customer,
  `conflicts` = another customer; soft-deleted rows count as not found).
- `register(customerId, garments: { tag, imageUrl, itemId | null }[], actor)`:
  1. Reject duplicates within the request and any conflict (nothing written).
  2. `batchAppend` LaundryItems for `new` tags (`id` = tag, `customer_id`, `item_id`, `image_url`).
  3. `batchAppend` LaundryItemPhotos `REGISTRATION` (`order_id` null) for every new tag, and for a
     `registered` tag of this request that has no `REGISTRATION` photo yet (a retry after step 3
     failed).
  4. Return `{ registered: string[], alreadyRegistered: string[], failed: string[] }`.

It needs `batchAppend` on both repositories (the LaundryItems module's wrapped repository exposes only
`read`, `append`, `update` today). Writes are sequential, not atomic (existing precedent).

### `POST /api/laundry-items/register`

Custom route in `laundry-item.module.ts`, next to the CRUD routes (precedent: LaundryPhotos
`reassign`). Body `{ customerId, garments: [{ tag, imageUrl, itemId | null }] }` (1 or more),
`createdBy` from the session. Errors: 400 bad body or duplicate tag, 404 unknown customer, 409
`{ conflictingTags }`. `201` → the service result plus `aiTriggered: boolean`.

After the writes, if any registered garment has no `itemId`, trigger MagicwashAI
`POST {VITE_AI_GATEWAY_URL}/tasks/classify-laundry-items` with `Authorization: Bearer <AI_GATEWAY_SECRET>`,
`X-Acting-Staff-Id`, body `{ "input": {} }` (no orderIds; nothing to submit), 15 s timeout, awaited.
A trigger failure does not fail the request. The URL comes from the existing `VITE_AI_GATEWAY_URL` (set in all three Vercel environments; server functions read it too), so no new env var. `AI_GATEWAY_SECRET` is set in all three.

## Design — frontend

- **Shared pieces.** The page lives in `src/features/customers/`. Features must not import each other
  (`docs/architecture/frontend/feature-structure.md`), so the parts both this page and the order pages
  use move to `src/shared/` with their behavior unchanged: `GarmentRegistrationCamera.vue`,
  `garment-registration.ts`, `OrderTagPrintConfirmDialog.vue`. Order pages only change import paths.
- **Tag print.** `createLaundryTagPrintRequest` takes `customerIndex` and a count; the order becomes
  optional (today it only supplies the default count).
- **Uploads.** New `src/shared/api/firebase-storage.ts` `deleteFromStorage(url)` and a shared composable
  `useGarmentPhotoUploads` (per photo `uploading` / `done` / `failed`, retry, delete). The Intake Order
  page reuses both in its next round.
- **Data.** `src/data/laundry-items/laundry-item.service.ts`: `getLaundryItem(tag)`,
  `registerLaundryItems(payload)`.
- **Page.** `/customers/:customerId/garments/register`, shell like the Intake Order page: customer card,
  a garment grid (photo + tag + upload state), camera button, Print tags button, footer Discard /
  Save. Save is disabled while any photo is `uploading` or `failed`, or there is no garment. On
  success: notice "N registered, M already registered", then back to customer detail.
- **Entry.** "Register Garments" in the Order History create menu (`OrderList.vue`), every customer.

## Order scan flow (next phase, outline only)

Staff scan each garment's tag into the order; each scan writes one OrderGarments row with
`RECEIVED`. Whether a tag is permanent or disposable does not matter here — every garment already
has one. Grouping into OrderItems and job-ticket provisioning from OrderGarments are designed in
that phase.

## Decisions

Owner:

1. Every garment is registered (tag + photo) into LaundryItems before any order.
2. Registration needs no service type, purpose, or due date.
3. A garment that cannot be confirmed as a known one is a new row. Look-alike garments with
   removable tags are an accepted blind spot.
4. OrderItems stay as they are; a new per-garment link sheet joins them to LaundryItems.
5. The link sheet keeps the garment's current stage in a single `status` column.
6. The first photo at registration is a `REGISTRATION` photo, kept apart from each order's
   `BEFORE` photo (2026-10-24); its URL goes into `LaundryItems.image_url`.
7. A new single photo sheet for garments, with a type column instead of separate BEF/AFT sheets.
   Old photo sheets are not modified.

Claude (minor, decided without asking):

8. Sheet names `OrderGarments` and `LaundryItemPhotos`.
9. `status` value list and write events above.
10. `photo_type` values `REGISTRATION`, `BEFORE`, `AFTER`, `DEFECT` (owner split registration from
    per-order before photos, 2026-10-24); first order's `BEFORE` reuses the registration URL.
11. Registration page lives under the customer, reached from the Order History create menu.
12. Unknown garment type stays null at save. The register route triggers MagicwashAI's
    `classify-laundry-items` (live since 2026-10-24) when a new garment has no type.
13. Save is one request with batch appends; a tag already registered to the same customer is
    skipped, not an error.
14. LaundryItems rows are created only by the registration service (owner, 2026-10-24); the Intake
    Order save calls it.
15. No garment-type picker on the page in this round; AI types the garments. Staff correct types on
    the Intake review page.
16. Photos upload at capture; removing a photo or Discard deletes its Firebase file (owner,
    2026-10-24). Whether staff may delete is checked in the browser test (Storage rules are not in
    this repo).

## Work items

Done: both sheets (in the LaundryItems spreadsheet), their registry JSONs on G Drive, contracts,
repositories and generic CRUD routes.

This branch:

| round | item | estimate |
|---|---|---|
| 1 backend | registration service, register route, MagicwashAI trigger, env, tests, operations.md | ½–1 day |
| 2 frontend | move shared pieces, tag print without order, upload/delete composable, data service | ½ day |
| 3 frontend | Register Garments page + entry | 1 day |
| 4 live | register 2–3 test garments, check sheets, AI typing, file delete | ½ day |

Later: order scan flow, `status` writes from job tickets, the one-row-per-garment-per-order rule.

## Out of scope

- Order scan flow and OrderItems grouping (next phase).
- `status` writes from job tickets (next phase, with the order scan flow).
- Flat-cloth images. (AI classification itself now runs in MagicwashAI, decision 12.)
- Moving existing screens (order detail registration, photo library, AFT upload, job-ticket
  provisioning) from LaundryPhotos/AfterPhotos to LaundryItemPhotos.
