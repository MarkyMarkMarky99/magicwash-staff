# Image pipeline — measured state and what is left

Written 2026-09-08. Numbers here are measured against the live bucket, not estimated.

## How uploads work now

One module does every upload: `src/shared/api/firebase-storage.ts`. Every caller calls
`uploadToStorage(file, folder)`; the folder is the only thing that differs.

| Caller | Route | Folder | Sheet written |
|---|---|---|---|
| `src/composables/usePhotoUpload.js` → `OrderGalleryPage.vue` | `/gallery/:key` | `images/` | `LaundryPhotos` / `AfterPhoto` |
| `src/features/orders/stores/order-image.store.ts` → `OrderDetailPage.vue` | `/orders/:orderId` | `order-images/<orderId>/` | `OrderImages` |
| `src/features/issue-reports/composables/use-screenshot-upload.ts` → `IssueReportFormPage.vue` | `/issue-reports/new` | `issue-reports/` | `IssueReports.ScreenshotUrl` |

The screenshot upload is the odd one out: it writes no photo row. `ScreenshotUrl` is a single
column on the issue report itself, so the composable holds the URL until the form is submitted and
one screenshot replaces another rather than appending.

The two **sheets** are separate on purpose; the **upload** never needed to be. Before this change
the same nine lines existed twice, in `src/api/storage.js` and
`src/features/orders/services/order-image-storage.service.ts`, both now deleted along with the dead
`uploadImage` / `uploadImages` exports that nothing had imported.

## Where image bytes actually come from

No path lets a user pick an arbitrary file; every image is JPEG-encoded in the browser first.

| Producer | Quality | Max dimension | Measured result |
|---|---|---|---|
| `CameraOverlay.vue:192-198` (`encodeCanvasToJpeg`) | 0.82 | 1280 px | ~213 KB |
| `DocumentScannerOverlay.vue:635-638` | 0.88 | 2400 px | ~700 KB |
| `usePhotoUpload.js:41` (`compressImage`, gallery album picks only) | binary search | 1920 px | ≤200 KB by construction |
| `use-screenshot-upload.ts` (`compressImage`, every pick) | binary search | 1920 px | ≤200 KB by construction |

**`order-image.store.ts` never calls `compressImage`.** It uploads whatever `CameraOverlay` or
`DocumentScannerOverlay` hands it, so its files carry no size ceiling — the ~700 KB scans above are
that path. Putting `compressImage` in front of its `uploadToStorage` is open work; see
`.user/memory/MEMORY.md`.

Sample of four real objects: 703 KB, 672 KB, 213 KB, 214 KB — average **450 KB**. Two further
objects measured 759 bytes at 2×2 pixels; those belong to the UAT test orders `246fde2b` and
`f68ae08d` listed for manual deletion in `.user/memory/MEMORY.md`, not to real work.

## Caching

Firebase served `Cache-Control: private, max-age=0` with an ETag, so a repeat view downloaded
nothing but still paid a round trip: **304 in 0.36s**, against 0.50s for the full 719 KB body. That
is why reopening a gallery felt slow.

`uploadToStorage` now stamps `private, max-age=31536000, immutable` at upload time. The header is
stored on the object, so every device that downloads it caches locally — not just the device that
uploaded. Object names always carry `Date.now()`, so nothing is ever overwritten and `immutable` is
safe.

**Existing objects still carry the old header.** They need a one-off metadata backfill
(`firebase-admin`, or `gcloud storage objects update`), which needs credentials for the bucket
`magicwashlaundry-a50ca.firebasestorage.app`.

## Resizing by URL is not possible

Confirmed by direct test and by documentation search. `firebasestorage.googleapis.com` accepts only
`alt=media` and `token`; it is Google Cloud Storage and returns the stored bytes. `&w=200`,
`&width=200`, `=s200` and `&size=200` each returned the identical 719,557 bytes.

The `=s200` style that does exist belongs to the App Engine Images API on `lh*.ggpht.com`, and
Firebase documents `*.firebasestorage.app` buckets (created after September 2024 — ours) as
independent of App Engine. That route is closed.

Any thumbnail therefore has to be a **second stored object**, which needs a second URL column on the
`OrderImages` sheet. The download URL carries a per-object token, so a thumbnail URL cannot be
derived from the original.

## Open, in rough order of value

1. **Backfill `cacheControl` on existing objects.** Until then only new uploads skip the round trip.
2. **Decide whether `DocumentScannerOverlay` needs 2400 px at quality 0.88.** It produces files
   three times larger than the camera path. It scans documents that must stay readable, so this is a
   judgement call on real scans, not a number to lower blindly.
3. **Thumbnails.** Dropped for now by the user. Reviving it means adding a `thumbnail_path` column:
   the G Drive schema registry JSON first (owner edits it; agents must not), then the sheet column
   and grid width, then the db-contract, the API contract, and the mapper.

## Not a problem

Browser HTTP cache does not bloat the device: the browser manages its own quota and evicts on its
own. Holding image bytes in JS instead would be strictly worse — it costs memory and is lost on
every refresh.
