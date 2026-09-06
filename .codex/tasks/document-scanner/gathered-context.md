# Document scanner — gathered context

Groundwork only. Gathered 2026-09-06 by grok-explorer from the repo at `main`.
Nothing here is a plan or a decision — it is the map someone needs before planning
live document-edge detection for the DOCUMENT photo type on the order detail page.

Verify a file:line before relying on it; this was written by a reader, not a compiler.

---

This splits cleanly into three independent scopes. I'll launch three explore agents in parallel: capture/camera UI, upload/processing paths, and deps/constraints.Subagent spawn was blocked, so I’ll search the repo directly for the capture chain, camera, upload path, and constraints.Key files are identified. Next I’ll read the capture chain, camera overlay, upload path, and constraint docs.## Summary

On `/orders/:orderId`, the capture button lives in `OrderImageCaptureMenu` inside `OrderImageSection`. It emits one of `WEIGHT` / `BELONGING` / `DOCUMENT`; the page maps that to `?orderAction=photo-weight|photo-belonging|photo-document` and opens the shared `CameraOverlay`. DOCUMENT already has its own query value, but it uses the **same camera, same JPEG encode, and same Firebase + `/api/order-images` save path** as BELONGING. Only WEIGHT is special (a weight prompt plus a `quantity` field). There is no live edge detection, no per-frame processing, no WASM/OpenCV/OCR dependency, and `CameraOverlay` is import-only with two consumers.

## Findings

### 1. THE CAPTURE ENTRY POINT

1. Route: `/orders/:orderId` → `OrderDetailPage.vue` (`src/features/orders/routes.ts:6`).
2. Page renders `OrderImageSection` and wires `@capture="openCapture"` (`OrderDetailPage.vue:178`).
3. `OrderImageSection` renders the capture control as `OrderImageCaptureMenu` and re-emits its `capture` event (`OrderImageSection.vue:14-16,33`).
4. The visible button is labeled `เพิ่มรูป` (`OrderImageCaptureMenu.vue:20-29`). The menu is a `BaseDropdown` listing `ORDER_IMAGE_TYPES` in order (`OrderImageCaptureMenu.vue:35-42`).
5. Each menu row: icon + Thai label, then `close()` + `emit('capture', imageType)` (`OrderImageCaptureMenu.vue:9-11,39-42`).
   - `WEIGHT` → น้ำหนัก / `scale`
   - `BELONGING` → ของลูกค้า / `shopping_bag`
   - `DOCUMENT` → เอกสาร / `description`
   (`order-image-labels.ts:1-15`)
6. Page handler `openCapture(imageType)` calls `orderOverlay.open(imageTypeToOverlay[imageType])` (`OrderDetailPage.vue:102-104`).
7. Overlay mechanism: **query param `orderAction`**, not a nested route. Mapping (`use-order-overlay-route.ts:6-12,32-39,67-82`):

   | Menu type | Query |
   |---|---|
   | WEIGHT | `?orderAction=photo-weight` (then also `?weight=<kg>` after the prompt) |
   | BELONGING | `?orderAction=photo-belonging` |
   | DOCUMENT | `?orderAction=photo-document` |

   Open uses `router.push` when no overlay is open, `router.replace` when switching overlays (`use-order-overlay-route.ts:67-81`). Close uses `router.back()` only if this page pushed the entry; otherwise `router.replace` strips the query (`use-order-overlay-route.ts:84-92`). Open state is a `computed` off the route, not a local `ref` (`use-order-overlay-route.ts:61; OrderDetailPage.vue:39,53-63`).
8. WEIGHT extra step: `isWeightPromptOpen` is true while `orderAction=photo-weight` and `weight` is missing/invalid (`OrderDetailPage.vue:58-62`). `OrderImageWeightPrompt` (a `BaseOverlay`) collects kg, then `submitWeight` → `orderOverlay.setWeight` writes `?weight=` (`OrderDetailPage.vue:98-100; use-order-overlay-route.ts:95-96; OrderImageWeightPrompt.vue:17-26,47-58`). Camera stays closed until that weight is on the route (`OrderDetailPage.vue:63`).
9. Camera open flag: `isCameraOpen = captureImageType !== null && !isWeightPromptOpen` (`OrderDetailPage.vue:63`). Template: `<CameraOverlay :open="isCameraOpen" @close="orderOverlay.close" @capture="handleCapture" />` (`OrderDetailPage.vue:178`). DOCUMENT and BELONGING open the camera immediately. The camera does **not** close after a shot; `handleCapture` never calls `close()` (`OrderDetailPage.vue:122-127`).
10. Legacy `?capture=` is deleted on overlay changes and is **not** read as a photo overlay (`use-order-overlay-route.ts:14,24-29,36`; test: `use-order-overlay-route.dry-test.ts:22-25`). Stale planning doc `docs/features/orders/forms/create-order-image.md:9,73-74` still says `?capture=1` — live code superseded that.
11. `CameraOverlay` itself does not touch history (`CameraOverlay.vue` has no `history`/`popstate`). The page composable owns the route.

### 2. THE PHOTO TYPES

1. Canonical writable set: `['WEIGHT', 'BELONGING', 'DOCUMENT']` in two places:
   - API enum: `contracts/order-images/order-image-api.schema.ts:5`
   - Frontend labels: `src/features/orders/order-image-labels.ts:1-3`
2. Create requests must be one of those three (`order-image-api.schema.ts:39-43`). Response `imageType` is a free `z.string().nullable()` so legacy rows (`BAG`, `HANGERS`, `Document`, blanks, …) still list (`order-image-api.schema.ts:23`; db comment `OrderImages.db-contract.ts:30-31`; schema test `order-image-api.schema.dry-test.ts:70-102`).
3. DB column `image_type` is a free string, not an enum (`OrderImages.db-contract.ts:11,30-31`).
4. Every switch/branch on type in the capture/save path:
   - Overlay maps: `use-order-overlay-route.ts:9-10`
   - WEIGHT-only camera gate + `?weight=`: `OrderDetailPage.vue:58-63`
   - WEIGHT-only quantity on save; other types send `quantity: null`: `order-image.store.ts:40-44`
   - Labels/icons: `order-image-labels.ts:5-15`
5. **DOCUMENT does not behave differently anywhere in capture, camera, compression, upload, or API.** It shares the same `CameraOverlay` instance and the same `captureImage()` path as BELONGING. The only type with a different code path is WEIGHT (prompt + `quantity`). Backend `OrderImageService` does not branch on type (`order-image.module.ts:91-115`).

### 3. THE CAMERA COMPONENT

File: `src/shared/components/CameraOverlay.vue` (plain `<script setup>`, not TypeScript). Prop: `open: Boolean` (`CameraOverlay.vue:5-10`). Emits: `close`, `capture` (`CameraOverlay.vue:12`).

**Stream**
- `navigator.mediaDevices.getUserMedia` (`CameraOverlay.vue:222-237`).
- Constraints: `{ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }` (`CameraOverlay.vue:230-237`). No `exact`, no `frameRate`.
- Assigned to a `<video>` via `srcObject` then `play()` (`CameraOverlay.vue:253-256`).
- Missing API → Thai error “กล้องใช้ได้เมื่อเปิดผ่าน HTTPS หรือ localhost” (`CameraOverlay.vue:222-224`).
- `NotAllowedError` → “ไม่ได้รับอนุญาตให้ใช้กล้อง”; any other throw → “เปิดกล้องไม่สำเร็จ” (`CameraOverlay.vue:257-261`). Retry button calls `startCamera` again (`CameraOverlay.vue:384-389`).

**Preview**
- Full-viewport `<video autoplay muted playsinline class="absolute inset-0 h-full w-full object-cover">` (`CameraOverlay.vue:346-352`). CSS `object-cover` crops the live view; the saved frame is the **full** `video.videoWidth` × `video.videoHeight`, then capped (see shutter). Preview crop ≠ saved pixels.
- White flash overlay (`CameraOverlay.vue:354-357,69-77`). Flyout `<canvas>` is **feedback only** (`CameraOverlay.vue:359-364,138-165,101-128`). Thumbnail of last file via `URL.createObjectURL` (`CameraOverlay.vue:167-182,402-407`).
- No viewfinder overlay, no quad outline, no document mask.

**Shutter / file**
- `capturePhoto` reads `video.videoWidth/Height`, caps the long side to **1280** (`CAPTURE_MAX_DIMENSION`, `CameraOverlay.vue:36,302-311`), `canvas.getContext('2d')` with `imageSmoothingQuality = 'high'`, `drawImage(video, …)` (`CameraOverlay.vue:307-311`).
- Queue encodes with `encodeCanvasToJpeg(canvas, 0.82)` → `canvas.toBlob(..., 'image/jpeg', 0.82)` (`CameraOverlay.vue:37,192; imageCompression.js:77-80`).
- Emits `new File([blob], \`camera_${Date.now()}_${n}.jpg\`, { type: 'image/jpeg' })` plus `{ skipCompression: true }` (`CameraOverlay.vue:196-198`).
- Order-detail handler **ignores the second argument**: `async function handleCapture(file: File)` (`OrderDetailPage.vue:122-127`). Gallery forwards it (`OrderGalleryPage.vue:142-144`).
- Burst: shutter re-enables after 900 ms; encodes are queued (`CameraOverlay.vue:46-48,130-136,184-214,286-321`). Camera stays open.

**Per-frame processing**
- **None.** No `requestAnimationFrame` loop, no `getImageData`, no detector. Canvas work is shutter-time `drawImage` plus the flyout copy.

**Cleanup**
- `stopCamera`: increment start token, clear `srcObject`, `getTracks().forEach(stop)`, clear timers/preview URL (`CameraOverlay.vue:267-278`).
- `watch(open)` starts/stops (`CameraOverlay.vue:324-334`). `onBeforeUnmount` sets `disposed`, drops the queue, stops tracks (`CameraOverlay.vue:336-341`). Close button emits `close` after `stopCamera` (`CameraOverlay.vue:281-283,400,429`).

**Consumers (import-only rule applies)**
| File | How it opens |
|---|---|
| `src/features/orders/pages/OrderDetailPage.vue:16,178` | `:open="isCameraOpen"` from `?orderAction=` |
| `src/features/gallery/pages/OrderGalleryPage.vue:7,359-362` | `:open="showCamera"` — local `ref`, plus optional path `/gallery/:key/camera` (`gallery/routes.ts:5`; `OrderGalleryPage.vue:42,107-110,132-135,160-166`) |

No other `getUserMedia` call sites. No `useCamera` composable.

### 4. THE UPLOAD/SAVE PATH (order images only)

From shutter to sheet row:

1. `CameraOverlay` already produced a JPEG ≤1280px at quality 0.82 (`CameraOverlay.vue:36-37,302-311,192-198`).
2. `handleCapture` → `orderImageStore.captureImage({ orderId, imageType, file, quantity })` (`OrderDetailPage.vue:122-127`). `quantity` is the route weight for WEIGHT, else `null` (`OrderDetailPage.vue:58-60,125-127; order-image.store.ts:44`).
3. **No second compression on this path.** `uploadOrderImage` uploads the File as-is (`order-image-storage.service.ts:4-8`). `compressImage` / 200 KB cap is **not** used here (that is gallery/`src/api/storage.js`).
4. Firebase Storage: `uploadBytes` to `order-images/${orderId}/${Date.now()}_${file.name}`, then `getDownloadURL` (`order-image-storage.service.ts:4-8; firebase.js:1-14`, bucket `magicwashlaundry-a50ca.firebasestorage.app`).
5. POST `/api/order-images` with camelCase create payload (`order-image.service.ts:5-16; api-client.ts:83-87,98-112`). Gateway: `api/[...path].ts:1-5` → registry `'order-images'` (`route-registry.ts:31-32`) → `createCrudRoutes` POST (`crud-routes.ts:18-27; order-image.module.ts:115`).
6. Sheet: `OrderImages` in `ORDERS_SPREADSHEET_ID` (`OrderImages.db-contract.ts:38-45`). Writes: `{ append: true, update: false, delete: false }` (`OrderImages.db-contract.ts:44`).
7. Fields written on create (`order-image.store.ts:49; order-image-api.schema.ts:39-47; order-image.module.ts:16-27`):

   | API | DB |
   |---|---|
   | `orderImageId` (server `generateShortId`) | `id` |
   | `orderId` | `order_id` |
   | `customerId: null` | `customer_id` |
   | `deliveryId: null` (omitted from append if null) | `delivery_id` |
   | `imageType` | `image_type` |
   | `imagePath` (https download URL) | `image_path` |
   | `notes: null` | `notes` |
   | `quantity` (WEIGHT kg or null) | `quantity` |
   | `createdBy` (`currentActor()` → `'admin'` unless `?by=`) | `created_by` |
   | (repo stamps) `created_at` | `created_at` |

   `imagePath` must be `http(s)://` (`order-image-api.schema.ts:31-37`).
8. **Dimensions / orientation:** altered at capture — downscaled to max 1280, re-encoded JPEG 0.82, **no EXIF written** (canvas `toBlob`). Preview `object-cover` does not match saved pixels. After that, order-image upload does not resize/rotate. `compressImage` (gallery only) would also strip EXIF via `Image` + canvas (`imageCompression.js:4-11,91-100`).

### 5. WHAT IS ALREADY AVAILABLE

**`package.json` runtime deps** (`package.json:13-20`): `axios ^1.14.0`, `firebase ^12.13.0`, `pinia ^3.0.4`, `vue ^3.5.30`, `vue-router ^4.6.4`, `zod ^3.25.76`.

**Dev:** `@playwright/test ^1.63.0`, `@tailwindcss/vite ^4.2.2`, `@vercel/node ^5.8.14`, `@vitejs/plugin-vue ^6.0.5`, `autoprefixer`, `postcss`, `sass`, `tailwindcss ^4.2.2`, `typescript ^6.0.3`, **`vite ^8.0.1`**. Scripts: `"build": "vite build"` (`package.json:9`) — esbuild, no frontend `tsc`. `"typecheck:api"` only (`package.json:11`).

**Image / canvas / vision / OCR / OpenCV / jscanify / dynamsoft / tensorflow:** **none** as direct dependencies.

**Web workers / OffscreenCanvas / app WASM:** **none** under `src/`, `api/`, `server/`, `public/`, `index.html`. `requestAnimationFrame` appears only in an e2e helper (`tests/e2e/base-overlay.spec.ts:117-119`). Lockfile WASM (`@rolldown/binding-wasm32-wasi`, `@tailwindcss/oxide-wasm32-wasi`) is build-tool optional, not shipped as an app detector.

**CSP / headers / CDN:**
- `vercel.json:1-7` — rewrites only, **no `headers`**.
- `index.html` — **no CSP meta**. It does load Google Fonts from `fonts.googleapis.com` (`index.html:8-9`).
- `vite.config.js` — **no headers**.
- Repo-wide `Content-Security-Policy` search: **none**.
- No COOP/COEP (would matter for `SharedArrayBuffer` / threaded WASM). Nothing currently blocks a Vite-bundled WASM file; nothing configures it either.

### 6. EXISTING IMAGE PROCESSING IN-REPO

| Location | What it does |
|---|---|
| `src/utils/imageCompression.js:1-101` | Only pixel pipeline. `MAX_SIZE_BYTES = 200 KiB`, pre-scale cap 1920. `drawImage` → JPEG `toBlob` with binary-search quality; if still too big, shrink 0.75× and retry; floor quality 0.1. `encodeCanvasToJpeg(canvas, quality=0.82)` is a single `toBlob`. **No crop, no deskew, no EXIF/orientation, no thumbnail API.** |
| `src/shared/components/CameraOverlay.vue:36-37,101-128,286-311` | Capture downscale to 1280 + JPEG 0.82; `drawCanvasCover` is flyout animation only. |
| `src/api/storage.js:12-14` | `uploadImage` = `compressImage` then Firebase `images/`. **Not used by order-images.** |
| `src/composables/usePhotoUpload.js:41-44` | Gallery: compress unless `skipCompression`, then `uploadRaw`. Camera emits `skipCompression: true`, so gallery camera files skip the 200 KB compressor. |

No `createImageBitmap`, no `getImageData`, no cropper, no EXIF library.

### 7. THE OTHER PHOTO SYSTEM (do not mix)

| | A. Order-detail images (this change) | B. Laundry album `/gallery/:key` |
|---|---|---|
| UI | `OrderImageSection.vue`, `OrderImageCaptureMenu.vue`, `OrderImageWeightPrompt.vue`, `OrderDetailPage.vue` | `OrderGalleryPage.vue` only |
| Types | WEIGHT / BELONGING / DOCUMENT | BEF / AFT (before/after wash) (`OrderGalleryPage.vue:34-37,10-13`) |
| Camera | same `CameraOverlay`, opened by `?orderAction=` | same `CameraOverlay`, local `showCamera` and/or path `/gallery/:key/camera` (`gallery/routes.ts:5-6`) |
| Upload binary | `order-image-storage.service.ts` → Firebase `order-images/{orderId}/` | `usePhotoUpload.js` → `storage.js` `uploadRaw` → Firebase `images/` |
| Persist row | POST `/api/order-images` → Sheets API append `OrderImages` | `src/api/photos.js` POST Apps Script `GATEWAY_URL` `APPEND` to `BeforePhoto` / `AfterPhoto` (`photos.js:3,20-28,43-48`) |
| Read | GET `/api/order-images?orderId=` | GViz `getPhotos`: BEF reads sheet `LaundryPhotos`, AFT reads `AfterPhoto` (`photos.js:15-18,32-41`) |
| Contract | `contracts/order-images/order-image-api.schema.ts` | none (snake_case payload in `photos.js:47-55`) |
| Backend module | `server/modules/order-images/` | **no module**. `server/sheets/LaundryPhotos/` is **read-only** (`writes: append/update/delete all false`, `LaundryPhotos.db-contract.ts:26-36`) |
| Entry from order detail | image section | `openOrderGallery` / `openItemGallery` → `/gallery/BEF-…` (`OrderDetailPage.vue:110-120`) |

`api/CLAUDE.md:270` already warns that `src/api/photos.js` POSTs to Apps Script and bypasses the API.

### 8. CONSTRAINTS THE PLANNER MUST RESPECT

Quoted from the rule files (not invented):

1. **Shared import-only.** “Import from `src/shared/components/`. Do not create a new shared component and do not modify an existing one — not even to add a prop.” Reason: no frontend type-check, a broken prop ships green. If nothing fits: “build it locally inside your own feature folder and report it under SHARED GAPS”. Shared components “must not know the domain exists”. (`CLAUDE.md:160-168`)
2. **Overlays must never own browser history.** Overlay components (including `src/shared/layouts/`) must never call `history.pushState` / `back` / `forward` or listen for `popstate`. Raw `pushState` is invisible to vue-router and triggers `go(-1)` recovery. (`CLAUDE.md:170-174`)
3. **Dismissible overlay = route query param.** Template named `useOrderSheetRoute.ts` (`src/features/customers/composables/useOrderSheetRoute.ts:4-40`; actual order-image composable is `use-order-overlay-route.ts`). Open state is a `computed` from the route, never a local `ref` (KeepAlive stale-mirror trap). Close with `router.back()` only if this page pushed; else `router.replace` to strip the query. Navigate-away uses `replace`, not close-then-push. (`CLAUDE.md:176`)
4. **No nested/`children` routes.** “There are **no nested/`children` routes anywhere in this project.** Do not introduce them for this.” (`CLAUDE.md:178`) Confirmed: no `children:` in any `routes.ts`.
5. **KeepAlive exclude** (`CLAUDE.md:182-188`; actual list `src/App.vue:16-19`): `CreateAppointmentPage`, `RescheduleAppointmentPage`, `InvoiceCreatePage`, `CustomerCreatePage`, `CustomerPackageCreatePage`, `PriceListFormPage`, `PackageFormPage`, `IssueReportFormPage`, `OrderCreatePage`. Matches **component name**, not path. Form pages on that list must use `onMounted`, not `onActivated`. **`OrderDetailPage` and `OrderGalleryPage` are not on the list → they are cached.** Overlay open state on order detail is therefore route-computed on purpose.
6. **No frontend type-check.** “this project has **no frontend type-check** (`npm run build` is esbuild only)” (`CLAUDE.md:162; package.json:9`).
7. **Tests.** No jest/vitest/mocha. Web: `npx tsx --tsconfig jsconfig.json <path>` under `tests/web/unit/<mirrored src path>/<name>.dry-test.ts`. Server: `npx tsx <path>` under `tests/server/...`. (`CLAUDE.md:80-93; api/CLAUDE.md:230-252`)
8. **API contract / no frontend mappers.** DTOs from `@contracts/...` via `z.infer`; “Do not add frontend field mapping layers”; if the UI needs a different shape, fix the backend contract (`CLAUDE.md:40-56,72-78; api/CLAUDE.md:23-24,111-120`). Order-images already follow this (`order-image.service.ts:2-8`).
9. **Schema registry.** `G:\My Drive\Magicwash\Database\GoogleSheets\*.json` is read-only; when registry and code disagree, change the code (`api/CLAUDE.md:276`).

Existing tests a planner will hit: `tests/web/unit/features/orders/composables/use-order-overlay-route.dry-test.ts`, `order-image-weight-query.dry-test.ts`, `order-image-labels.dry-test.ts`, `tests/server/unit/contracts/order-images/order-image-api.schema.dry-test.ts`, `tests/server/unit/modules/order-images/order-image-wiring.dry-test.ts`. There is **no** CameraOverlay unit test.

### 9. OPEN QUESTIONS (code does not settle)

1. Does DOCUMENT keep Back-to-close via existing `?orderAction=photo-document`, or does a scanner need extra query state (quad confirm, retake, multi-page)?
2. Is the scanner a **feature-local** component under `src/features/orders/` (shared import-only), or a dedicated shared-component refactor that also re-checks the gallery call site?
3. Live viewfinder detection vs still-frame detect-then-crop — nothing in-repo implies either.
4. Where deskew sits relative to the existing 1280 / JPEG 0.82 encode, and whether the 200 KB `compressImage` path should apply to deskewed DOCUMENT files (today order-images skip it).
5. Coordinate space: video pixels vs CSS `object-cover` preview — a quad drawn on the video element will not match `videoWidth`/`videoHeight` without mapping.
6. Multi-shot session (camera stays open today) vs one document then close.
7. Library vs in-house (OpenCV.js / WASM / jscanify / other) — no vision stack exists; CSP/COOP/COEP/workers are all unset.
8. Whether WEIGHT/BELONGING must remain on unmodified `CameraOverlay` while DOCUMENT forks.
9. Device constraints: `facingMode: ideal environment` and `1920x1080 ideal` are not guaranteed; no code handles a missing rear camera or a lower-res stream for detection.
10. Ignore stale `docs/features/orders/forms/create-order-image.md` (`?capture=1`, “no HTTP surface”) — live code already shipped a different overlay key and API.

## File References

- `src/features/orders/pages/OrderDetailPage.vue:16,39,53-63,98-127,178` — page orchestration, query-derived camera, handlers
- `src/features/orders/components/OrderImageSection.vue:14-16,33` — section that hosts the capture button
- `src/features/orders/components/OrderImageCaptureMenu.vue:1-42` — menu entries and emit
- `src/features/orders/components/OrderImageWeightPrompt.vue:17-26,47-58` — WEIGHT-only prompt
- `src/features/orders/composables/use-order-overlay-route.ts:6-99` — `orderAction` / overlay maps / push-back-replace
- `src/features/orders/order-image-labels.ts:1-22` — type set, Thai labels, icons
- `src/features/orders/stores/order-image.store.ts:39-55` — WEIGHT quantity gate + upload then create
- `src/features/orders/services/order-image-storage.service.ts:1-8` — Firebase path, no compress
- `src/features/orders/services/order-image.service.ts:1-16` — `/api/order-images`
- `src/features/orders/routes.ts:6` — order detail route
- `src/shared/components/CameraOverlay.vue:1-487` — full camera overlay
- `src/utils/imageCompression.js:1-101` — only in-repo pixel pipeline
- `src/api/storage.js:1-18` — gallery Firebase helper with compress
- `src/composables/usePhotoUpload.js:1-80` — gallery compress/upload/Apps Script save
- `src/api/photos.js:1-48` — gallery GViz read + Apps Script APPEND
- `src/features/gallery/pages/OrderGalleryPage.vue:7,34-42,132-166,359-362` — other photo system + second CameraOverlay consumer
- `src/features/gallery/routes.ts:4-8` — `/gallery/:key` and `/camera` path
- `src/firebase.js:1-14` — Storage bucket
- `src/App.vue:16-19` — KeepAlive exclude list
- `src/shared/config/actor.ts:1-14` — `createdBy` fallback `'admin'`
- `src/shared/api/api-client.ts:83-112` — POST JSON envelope
- `src/features/customers/composables/useOrderSheetRoute.ts:4-40` — overlay-query template named in CLAUDE.md
- `contracts/order-images/order-image-api.schema.ts:5-63` — API enum + create/list shapes
- `server/modules/order-images/order-image.module.ts:16-115` — field map, CRUD routes, no type switch
- `server/sheets/OrderImages/OrderImages.db-contract.ts:4-45` — sheet columns, free `image_type`, append-only
- `server/sheets/OrderImages/OrderImages.repository.ts:1-10` — repository getter
- `server/sheets/LaundryPhotos/LaundryPhotos.db-contract.ts:4-36` — other system's sheet, writes closed
- `server/api/route-registry.ts:31-32` — `'order-images'` loader
- `server/shared/http/crud-routes.ts:17-27` — POST create
- `api/[...path].ts:1-5` — single gateway
- `package.json:6-32` — scripts and dependencies
- `vite.config.js:1-29` — Vite 8, no headers
- `vercel.json:1-7` — rewrites only, no CSP
- `index.html:1-14` — no CSP; Google Fonts CDN
- `CLAUDE.md:80-93,160-188` — tests, shared import-only, overlay-as-query, no nested routes, KeepAlive
- `api/CLAUDE.md:23-24,111-120,230-252,270,276` — contracts, tests, photos.js Apps Script warning, registry read-only
- `tests/web/unit/features/orders/composables/use-order-overlay-route.dry-test.ts:14-72` — query values including `photo-document`
- `tests/web/unit/features/orders/order-image-labels.dry-test.ts:14-31` — type set
- `tests/server/unit/contracts/order-images/order-image-api.schema.dry-test.ts:23,70-89` — enum on create, free string on read
- `docs/features/orders/forms/create-order-image.md:9,73-91` — stale plan (`?capture=1`); do not treat as live

Next action: start the later planning session with this report only; do not treat `CameraOverlay.vue` as editable and do not touch gallery/`photos.js`.
