> Status: PLANNING — not implemented.

# Create Order Image

## Route

Parent route: /orders/:orderId — name `order-detail`

Overlay query: `?capture=1`

Shell: feature-local camera overlay under `src/features/orders/components/` — see SHARED GAPS 4 in
`overview.md`

Purpose:
ถ่ายหรือเลือกรูปภาพสำหรับ Order

## User-supplied fields

| Field | Component | Notes |
|---|---|---|
| image file | camera / `input type="file" accept="image/*"` | Binary; uploaded first, never sent in the row payload |
| image_type | FormOptionGrid | Free string in the data, no enum defined and none proposed. 13 distinct live values — see Known data debt in `data-model.md`. The option set the form offers is unresolved. |
| notes | FormTextarea | Optional text; blank on 16,680 of 17,376 live rows |
| quantity | FormInput | Decimal weight in kg (e.g. `20.5`, `8.7`), not a count. Blank on 13,258 of 17,376 rows. What it means for an `image_type` other than `WEIGHT` is undocumented and unresolved. |

## Not user-supplied fields

| Field | Source |
|---|---|
| id | server-generated on append |
| order_id | route param `orderId` |
| image_path | the upload result URL |
| created_at | server-generated on append |
| created_by | server; effectively unused today (17,365 of 17,376 rows blank) |
| customer_id | **unresolved** — it is not on the route. It would come from the order detail DTO's `customerId`, which has no endpoint (Blocker 2). Registry `OrderImages.json` does not require it. |
| delivery_id | **not set** — a capture opened on `/orders/:orderId` has an order, not a delivery. Registry `OrderImages.json` does not require it, and the column is blank on 17,365 of 17,376 live rows. |

- Registry `OrderImages.json` requires only `id` and `order_id`.

## Two-step capture

1. Upload the binary image to a storage destination and receive a URL.
2. Append an `OrderImages` row carrying that URL in `image_path`, plus the fields above.

## Open decisions

Neither is decided here.

- **Write path.** Reuse the existing Apps Script `APPEND` gateway, or wait for a Sheets-API write
  path behind an orders module. The existing path does not target `OrderImages` at all:
  `src/composables/usePhotoUpload.js` uploads the binary to Firebase Storage via
  `src/api/storage.js`, then `src/api/photos.js` posts `{ resource: 'sheet', action: 'APPEND',
  target: 'BeforePhoto' | 'AfterPhoto', data }` with a snake_case payload. `LaundryPhotos` is a
  sheet that file *reads* from over GViz, not a write target.
- **Capture code ownership.** Move the capture stack into `src/shared/` in a dedicated refactor pass
  that checks every existing call site, or duplicate it inside `src/features/orders/`. Importing it
  where it stands is a forbidden cross-feature import.

## Existing gallery reference

Reference implementation only; not the chosen design, and not importable from orders.

- `src/features/gallery/components/CameraOverlayPage.vue` — live `getUserMedia` capture
- `src/features/gallery/pages/OrderGalleryPage.vue` — `input type=file`, `accept=image/*`, `multiple`
- `src/composables/usePhotoUpload.js` — compress, upload, save; max 10 files per pick
- `src/api/storage.js` — Firebase `uploadBytes` + `getDownloadURL`
- `src/api/photos.js` — GViz read, Apps Script `APPEND` write, snake_case payload
- `src/utils/imageCompression.js`
- `src/firebase.js`

## Overlay behaviour

- Open with the parameterised query-overlay composable in `src/features/orders/composables/`,
  query key `capture`, value `1`. `useOrderSheetRoute.ts` cannot be reused — its `QUERY_KEY` is
  hardcoded to `'order'`.
- Derive open state with `computed` from the route; never mirror it into a local `ref` — on a
  `KeepAlive`-cached page a stale mirror makes reopening a silent permanent no-op.
- `close()` calls `router.back()` only when this page pushed the entry; on a deep link or a refresh
  it strips `capture` with `router.replace`, because `router.back()` there would leave the app.
- Never call `history.pushState`, `history.back()`, `history.forward()`; never listen for
  `popstate`.

## Blockers

⛔ BLOCKED — `OrderImages` has no HTTP surface: no `server/sheets/` registration, no `contracts/`
api schema, no module, no route. Sheet-layer registration with
`writes: { append: true, update: false, delete: false }` is designed but not implemented, on branch
`feat/register-order-sheets`. See Blocker 5 in `overview.md`.

⛔ BLOCKED — there is no orders-owned camera component, and the only working implementation lives
outside the feature. See Blocker 6 in `overview.md`.
