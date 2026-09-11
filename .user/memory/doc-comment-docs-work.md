# Pending — documentation work behind the doc-comment cleanup

Deliberately held. `src/features/` is being audited the same way right now; when that returns,
merge its findings into this file and edit each `docs/` document **once**, rather than touching the
same convention twice from two directions.

## What is already done — do not redo

Branch `chore/remove-stale-code-comments`, three commits, 137 deleted lines and zero added:

- `97b1b39` — 15 comments whose claims contradicted the code, plus one test assertion that required
  a comment to exist.
- `b3d0272` — 37 section-banner comments.
- `0e6daf9` — 19 redundant or incorrect comments in the shared cache layer.

Everything below is what remains in `src/shared/`. The `src/features/` half is still outstanding.

## Before acting on any row here

**Every verdict below is a claim to verify, not an instruction.** The audit that produced them
already got one wrong: it called `ListContainer.vue`'s PropType comment a restatement of the prop
declaration when it actually records why the cast exists, and deleting it would have lost that.
Open the code and the cited document before you act on a row.

## Blocker on the ALREADY-DOCUMENTED rows

These 31 rows justify deletion by pointing at a document. Two problems:

1. **21 cite `docs/plans/cache-gateway.md`**, which declares itself build history and points at
   `docs/conventions/data-fetching.md` for live rules. A fact that lives only in a plan is not
   documented. Those rows are really MOVEs into the convention.
2. **19 cite `docs/conventions/data-fetching.md`** (overlapping with the above). That document and
   `docs/architecture/frontend/app-boot.md` were drafted by an earlier session, merged in `ccf187a`,
   and **the user has not read either.** Deleting 31 comments on their authority means trusting
   unreviewed documents.

So: the user reads `data-fetching.md` (74 lines) and decides whether `cache-gateway.md`'s live
content moves into the convention, **before** any of these comments is deleted.

## KEEP needs a second pass

24 KEEPs out of 86 blocks, against a brief that said a long block is almost never a KEEP. Each
proposed one-line `//` replacement needs reviewing before it is written; expect several to be
DELETEs on a closer look.

## Two real defects found, recorded and not fixed

Deleting a comment must never smuggle in a behaviour change, so these were left alone:

- `src/shared/api/persistent-cache.ts:77-81` — the parse guard checks object-ness and that `t` is a
  number. `parsed.v` is never validated, so a shape-mismatched value passes through.
- `src/shared/api/persistent-cache.ts:175-187` — if `removeItem` throws, the persisted entry
  survives and `promoteFromStorage` reads it back into memory. The next read does not revalidate.

---

## Rows still open — ALREADY-DOCUMENTED, MOVE, KEEP, UNVERIFIED

| Location | Defect | Evidence |
|---|---|---|
| `src/shared/api/persistent-cache.ts:55-56` | Claims the parse guard catches shape mismatches, but it only checks object-ness and numeric `t`; `v` is not validated. | Guard: `src/shared/api/persistent-cache.ts:77-83` |
| `src/shared/api/persistent-cache.ts:188-189` | Claims the next read revalidates even when persisted clearing fails. Persisted data can remain and be promoted back into memory. | Clear failure: `src/shared/api/persistent-cache.ts:175-189`; promotion: `src/shared/api/response-cache.ts:78-99,144-157` |
| `src/shared/api/response-cache.ts:132-133` | Claims the newly written entry may be evicted. Oversized entries are rejected before insertion, and normal eviction removes older entries first. | `src/shared/api/response-cache.ts:58-61,119-131`; test: `tests/web/unit/shared/api/response-cache.dry-test.ts:63-66` |
| `src/shared/components/BaseDropdown.vue:21-23` | Says callers mostly clip panels rather than scroll them. The shared implementation now wraps panels in `ScrollRegion`. | `src/shared/components/BaseDropdown.vue:109-120`; `src/shared/components/ScrollRegion.vue:29-34` |
| Location | Lines | Verdict | Claim | Evidence / reduced form |
|---|---:|---|---|---|
| `src/shared/api/api-client.ts:6-18` | 13 | UNVERIFIED | HTTP boundary, request validation, response pass-through, and dirty backend cells. | Code: `:64,121-125,161-170`; docs: `docs/conventions/data-fetching.md:17-21`, `docs/architecture/backend/operations.md:47-49`. The referenced `api/CLAUDE.md` and full `z.infer` call-site claim were not verifiable from the listed documents. |
| `src/shared/api/api-client.ts:40` | 1 | KEEP | Query input is validated before serialization. | Code: `:64-65,173-184`. Reduced form: `// Query input is validated and serialized before the request.` |
| `src/shared/api/api-client.ts:42` | 1 | ALREADY-DOCUMENTED | Request schemas validate public API inputs. | `docs/conventions/contracts/api.md:44-46`; `docs/conventions/coding.md:24-28` |
| `src/shared/api/api-client.ts:44-48` | 5 | ALREADY-DOCUMENTED | `onFresh` receives background-refresh results. | `docs/conventions/data-fetching.md:49-53` |
| `src/shared/api/api-client.ts:56-59` | 4 | KEEP | List items pass through without runtime response parsing. | Code: `:67-72,123-125`. Reduced form: `// List response items pass through without runtime parsing.` |
| `src/shared/api/api-client.ts:81-87` | 7 | ALREADY-DOCUMENTED | Cache hits, stale-while-revalidate, callback refresh, and request sharing. | `docs/conventions/data-fetching.md:35-36,49-53`; `docs/plans/cache-gateway.md:29-30,104-105` |
| `src/shared/api/api-client.ts:99-100` | 2 | KEEP | Background refresh failures are swallowed. | Code: `:98-106`. Reduced form: `// Background revalidation is best-effort and never replaces the cached value on failure.` |
| `src/shared/api/api-client.ts:109` | 1 | ALREADY-DOCUMENTED | Same-URL requests share one in-flight promise. | `docs/conventions/data-fetching.md:19-21`; `docs/plans/cache-gateway.md:104-105` |
| `src/shared/api/api-client.ts:134` | 1 | ALREADY-DOCUMENTED | Write bodies use shared API contracts. | `docs/conventions/coding.md:24-28`; `docs/conventions/contracts/api.md:44-46` |
| `src/shared/api/api-client.ts:173` | 1 | KEEP | Query serialization omits nullish and empty-string values. | Code: `:175-184`. Reduced form: `// Serialize query parameters, omitting nullish and empty-string values.` |
| `src/shared/api/api-client.ts:187` | 1 | KEEP | Valid error envelopes become `ApiError`; invalid ones degrade generically. | Code: `:188-197`. Reduced form: `// Build ApiError from a valid error envelope, otherwise use a generic message.` |
| `src/shared/api/api-client.ts:195` | 1 | KEEP | Invalid/non-JSON error bodies use the status message. | Code: `:189-197`. Reduced form: `// Non-JSON or invalid error bodies fall back to the generic status message.` |
| `src/shared/api/persistent-cache.ts:3-7` | 5 | ALREADY-DOCUMENTED | Storage-version changes purge incompatible entries. | `docs/conventions/data-fetching.md:40-47`; `docs/plans/cache-gateway.md:136-146` |
| `src/shared/api/persistent-cache.ts:16` | 1 | ALREADY-DOCUMENTED | Persisted timestamps preserve response freshness. | `docs/conventions/data-fetching.md:44-47`; `docs/plans/cache-gateway.md:106-108` |
| `src/shared/api/persistent-cache.ts:20-23` | 4 | KEEP | `localStorage` may be absent or throw on access. | Code: `:24-29`. Reduced form: `// Safely access localStorage when it is unavailable or throws on access.` |
| `src/shared/api/persistent-cache.ts:41-45` | 5 | ALREADY-DOCUMENTED | Import-time purge removes other storage versions. | `docs/architecture/frontend/app-boot.md:50-54`; `docs/plans/cache-gateway.md:144-146` |
| `src/shared/api/persistent-cache.ts:64` | 1 | ALREADY-DOCUMENTED | `storedAt` records response arrival time. | `docs/conventions/data-fetching.md:44-47`; `docs/plans/cache-gateway.md:106-108` |
| `src/shared/api/persistent-cache.ts:68` | 1 | KEEP | Read returns `null` on miss or unusable entry. | Code: `:68-89`. Reduced form: `// Read one persisted response; return null on a miss or unusable entry.` |
| `src/shared/api/persistent-cache.ts:85-87` | 3 | KEEP | Malformed or unreadable storage is treated as a miss. | Code: `:73-87`. Reduced form: `// Treat malformed or unreadable storage as a cache miss.` |
| `src/shared/api/persistent-cache.ts:91-98` | 8 | ALREADY-DOCUMENTED | Persisted budget and quota policy. | `docs/conventions/data-fetching.md:40-47`; `docs/plans/cache-gateway.md:122-127,136-146` |
| `src/shared/api/persistent-cache.ts:117-118` | 2 | MOVE M1 | Quota failure clears, retries once, then falls back to memory. | Code: `:114-124`; destination: `docs/conventions/data-fetching.md`, “Cache policy” |
| `src/shared/api/persistent-cache.ts:123` | 1 | ALREADY-DOCUMENTED | Memory cache continues when persistence fails. | `docs/plans/cache-gateway.md:122-127` |
| `src/shared/api/persistent-cache.ts:128-134` | 7 | ALREADY-DOCUMENTED | Persisted eviction uses stored age and a configured limit. | `docs/conventions/data-fetching.md:40-47`; `docs/plans/cache-gateway.md:136-143` |
| `src/shared/api/persistent-cache.ts:148` | 1 | KEEP | Unparseable entries sort oldest and are evicted first. | Code: `:143-150`. Reduced form: `// Treat unparseable entries as oldest so eviction removes them first.` |
| `src/shared/api/persistent-cache.ts:162` | 1 | KEEP | Recovery is deferred to the write retry path. | Code: `:156-163`. Reduced form: `// Defer recovery to the write path, which retries after a quota failure.` |
| `src/shared/api/persistent-cache.ts:166-170` | 5 | ALREADY-DOCUMENTED | Persistent invalidation mirrors endpoint and nested/query invalidation. | `docs/conventions/data-fetching.md:56-59`; `docs/plans/cache-gateway.md:92-93` |
| `src/shared/config/cache.ts:1-7` | 7 | ALREADY-DOCUMENTED | Read-only cache and explicit invalidation policy. | `docs/plans/cache-gateway.md:21-36`; `docs/conventions/data-fetching.md:17-21,56-59` |
| `src/shared/config/cache.ts:9-14` | 6 | ALREADY-DOCUMENTED | Zero-hour entries serve cached data before revalidation. | `docs/conventions/data-fetching.md:25-38`; `docs/plans/cache-gateway.md:32-36` |
| `src/shared/config/cache.ts:17-30` | 14 | UNVERIFIED | Endpoint-prefix policy and one-hour rationale are documented, but “raise it after real-world use” is not. | `docs/plans/cache-gateway.md:112-116` supports one hour; no listed document verifies `:29`. The same plan has an inconsistent undecided note at `:131-134`. |
| `src/shared/config/cache.ts:36-43` | 8 | ALREADY-DOCUMENTED | Only customers and price-list endpoints persist. | `docs/conventions/data-fetching.md:27-38`; `docs/plans/cache-gateway.md:95-97` |
| `src/shared/config/cache.ts:46` | 1 | ALREADY-DOCUMENTED | `NEVER_CACHE` bypasses caching. | `docs/conventions/data-fetching.md:29-36`; `docs/plans/cache-gateway.md:85-86` |
| `src/shared/config/cache.ts:49` | 1 | ALREADY-DOCUMENTED | In-memory cache has a 4 MiB LRU ceiling. | `docs/conventions/data-fetching.md:40-46`; `docs/plans/cache-gateway.md:88-89` |
| `src/shared/config/cache.ts:52-59` | 8 | UNVERIFIED | Persisted quota rationale, including issue-report storage, is not fully documented. | `docs/plans/cache-gateway.md:44-52,140-143`; no listed document verifies the issue-report reporter claim. |
| `src/shared/config/cache.ts:65-66` | 2 | ALREADY-DOCUMENTED | Freshness hours and zero-hour behavior. | `docs/conventions/data-fetching.md:29-38` |
| `src/shared/config/cache.ts:67-68` | 2 | ALREADY-DOCUMENTED | Persistence across reloads. | `docs/conventions/data-fetching.md:35-38`; `docs/plans/cache-gateway.md:35-36` |
| `src/shared/api/response-cache.ts:4-18` | 15 | ALREADY-DOCUMENTED | Cache layers, URL keys, LRU, persistence, and promotion. | `docs/conventions/data-fetching.md:25-47`; `docs/plans/cache-gateway.md:29-36,101-108` |
| `src/shared/api/response-cache.ts:24-28` | 5 | KEEP | Monotonic counter makes LRU deterministic within one millisecond. | Code: `:58-62,81`. Reduced form: `// Monotonic counter keeps LRU order deterministic within the same millisecond.` |
| `src/shared/api/response-cache.ts:67` | 1 | ALREADY-DOCUMENTED | Freshness flag semantics. | `docs/conventions/data-fetching.md:35-37,49-53` |
| `src/shared/api/response-cache.ts:71-76` | 6 | ALREADY-DOCUMENTED | Stale values return while refresh runs in background. | `docs/plans/cache-gateway.md:29-31` |
| `src/shared/api/response-cache.ts:88-91` | 4 | ALREADY-DOCUMENTED | Storage promotion preserves original timestamp. | `docs/plans/cache-gateway.md:106-108` |
| `src/shared/api/response-cache.ts:110-117` | 8 | KEEP | Promotion preserves age and avoids immediate writeback. | Code: `:99,107,113-116`. Reduced form: `// Preserve response age and avoid rewriting entries promoted from storage.` |
| `src/shared/api/response-cache.ts:120-122` | 3 | KEEP | Oversized responses are skipped rather than evicting everything. | Code: `:119-127`; test: `tests/web/unit/shared/api/response-cache.dry-test.ts:63-66`. Reduced form: `// Skip a response larger than the full budget instead of evicting existing entries.` |
| `src/shared/api/response-cache.ts:137-143` | 7 | ALREADY-DOCUMENTED | Explicit, full, and endpoint-prefix invalidation. | `docs/conventions/data-fetching.md:56-59`; `docs/plans/cache-gateway.md:25-30,92-93` |
| `src/shared/components/BaseSwipeCard.vue:81-90` | 10 | UNVERIFIED | Browser compatibility-click rationale for `preventDefault()`. | Implementation: `:91-92`; test only performs static assertions at `tests/web/unit/shared/components/base-swipe-card.dry-test.ts:12-15,31-63`; no runtime browser verification or matching docs. |
| `src/shared/utils/sheet-date.ts:58-62` | 5 | MOVE M2 | Civil dates and timestamps use different timezone semantics. | Code: `:67-68`; related but incomplete documentation: `docs/conventions/datetime.md`, “Read side,” lines 39-58 |
| `src/shared/utils/sheet-date.ts:73` | 1 | ALREADY-DOCUMENTED | User-visible date formatting. | `docs/conventions/datetime.md`, “Display formatting,” lines 71-75 |
| `src/shared/utils/sheet-date.ts:84` | 1 | ALREADY-DOCUMENTED | Bangkok date-time formatting. | `docs/conventions/datetime.md:7-10,71-75` |
| `src/shared/utils/sheet-date.ts:107` | 1 | MOVE M3 | Current Bangkok civil date for date-only fields. | Code: `:108-109`; `docs/conventions/datetime.md:7-10` lacks Bangkok-based today defaults |
| `src/shared/utils/sheet-date.ts:112` | 1 | MOVE M4 | Bangkok date, weekday, and local minutes for scheduling. | Code: `:114-130`; test: `tests/web/unit/shared/utils/sheet-date.dry-test.ts:53-56`; no matching canonical statement |
| `src/shared/utils/sheet-date.ts:133` | 1 | KEEP | Calendar-day addition avoids timezone arithmetic. | Code: `:135-139`; reduced form: `// Add calendar days to an ISO civil date without applying a timezone offset.` |
| `src/shared/utils/sheet-date.ts:142` | 1 | KEEP | Calendar fields use Sunday-based weekday numbering. | Code: `:148-154`; caller: `src/features/appointments/components/AppointmentForm.vue:120-122`. Reduced form: `// Return calendar fields for a civil date using Sunday=0 weekday numbering.` |
| `src/shared/utils/sheet-date.ts:158` | 1 | MOVE M5 | Whole-day distance between ordered ISO dates. | Code: `:160-166`; test: `tests/web/unit/shared/utils/sheet-date.dry-test.ts:47`; no canonical statement |
| `src/shared/components/NavSidebar.vue:19` | 1 | ALREADY-DOCUMENTED | Refresh clears cache and reloads because clearing alone does not refetch. | `docs/plans/cache-gateway.md:136-139` |
| `src/shared/components/ListContainer.vue:14` | 1 | KEEP | Inline JSDoc cast is required for strict nullable Vue typing. | Code: `:14`; strict checking: `tsconfig.web.json:6-10`. Reduced form for the surrounding rationale: `// Keep the nullable PropType<string | null> cast for strict Vue typing.` |
| `src/shared/components/ListContainer.vue:20-22` | 3 | MOVE M6 | Search is opt-in because reusable screens can contain multiple list sections. | Code: `:23`; usages in appointment and customer-detail pages; destination: `docs/design/patterns/list-pages.md`, “Filters” |
| `src/shared/components/ListContainer.vue:44-45` | 2 | KEEP | URL filters reveal the search field. | Code: `:36-46`. Reduced form: `// Reveal search when a non-empty URL filter arrives.` |
| `src/shared/utils/service-type-labels.ts:3-14` | 12 | MOVE M7 | Shared presentation map prevents feature-local service-type copies. | Map: `:18-23`; destination: `docs/features/orders/data-model.md`, “service_type — canonical values” |
| `src/shared/utils/service-type-labels.ts:25` | 1 | KEEP | Unknown service types remain raw on reads. | Code: `:26-29`. Reduced form: `// Preserve unknown service-type values on reads; known codes use the shared presentation map.` |
| `src/shared/config/actor.ts:1` | 1 | ALREADY-DOCUMENTED | Writes use `admin` until authentication exists. | `docs/features/orders/order-create-screen.md:21-26`; `order-item-form.md:19-21` |
| `src/shared/config/actor.ts:4-10` | 7 | UNVERIFIED | Query override and fallback work, but AppSheet provenance is not documented or independently verified. | Code: `:11-13`; caller: `src/features/gallery/pages/OrderGalleryPage.vue:35-37` |
| `src/shared/components/BaseDropdown.vue:32-34` | 3 | KEEP | Vue template refs may provide component instances. | Code: `:3,35-37`; usage: `src/features/orders/components/OrderItemsMenu.vue:18-21`. Reduced form: `// Accept Vue's component-instance ref shape so template refs type-check at every call site.` |
| `src/shared/api/firebase-storage.ts:8-14` | 7 | ALREADY-DOCUMENTED | Shared upload helper serves both photo systems; only folder differs. | `docs/plans/image-pipeline.md:5-18`; `docs/features/orders/forms/create-order-image.md:49-54,59-66` |
| `src/shared/stores/selected-customer.store.ts:6-17` | 12 | MOVE M8 | Cross-feature handoff and location fallback rules. | Code: `:20-42`; consumer: `src/features/appointments/pages/CreateAppointmentPage.vue:6,14`; destination: `docs/features/orders/overview.md`, “SHARED GAPS” |
| `src/shared/layouts/ListPageLayout.vue:5-7` | 3 | KEEP | Search belongs to `ListContainer`; layout owns filters and scroll region. | Code: `:20-26`; pattern: `docs/design/patterns/list-pages.md:18-29`. Reduced form: `// Search belongs to ListContainer; this layout owns filters and the page scroll region.` |
| `src/shared/components/FormPicker.vue:353-354` | 2 | KEEP | Long address and phone values must wrap. | CSS: `:350-356`. Reduced form: `// Long address and phone values must wrap within the option track.` |
| `src/shared/components/FormInput.vue:75-80` | 6 | KEEP | Native date control sizing is overridden to fit two-column fields. | CSS: `:81-90`; usage: `src/features/orders/pages/OrderCreatePage.vue:76`. Reduced form: `// Remove native date-control sizing so two date fields fit while the 47px control keeps a 45px content line.` |

## Documentation edits required for MOVE findings

### `docs/conventions/data-fetching.md` — Cache policy

M1, from `src/shared/api/persistent-cache.ts:117-118`:

> Persisted writes are best-effort. If a `localStorage` write fails, the cache clears persisted entries and retries once; if that also fails, reads continue from the in-memory layer and a reload starts cold.

### `docs/conventions/datetime.md`

M2, under the read/normalization guidance:

> Frontend date normalization must preserve date-only civil values while interpreting timestamp values as instants and taking their date in `Asia/Bangkok`. This prevents the host timezone from changing a civil date.

M3, under date-only defaults:

> Frontend date inputs and date-only defaults must use the current civil date in `Asia/Bangkok`, formatted as `yyyy-MM-dd`. They must not derive today’s value from the browser’s host timezone.

M4, under scheduling helpers:

> Frontend scheduling helpers derive the current date, weekday, and minutes since midnight from `Asia/Bangkok`. Scheduling decisions must not use the browser’s host timezone.

M5, under civil-date arithmetic:

> Calendar-day calculations on ISO civil dates must use date fields rather than elapsed local-time hours. The shared helper returns the whole-day difference from the `earlier` argument to the `later` argument.

### `docs/design/patterns/list-pages.md` — Filters

M6, from `src/shared/components/ListContainer.vue:20-22`:

> ListContainer search is opt-in because shared screens may render several list sections at once. The appointment schedule renders four containers, while customer detail swaps among order, package, and invoice sections. Enable `searchable` only for the page’s primary browse list.

Note: `docs/features/orders/overview.md:129-132` still describes search as owned by `ListPageLayout`, conflicting with the current code and `docs/design/patterns/list-pages.md`.

### `docs/features/orders/data-model.md` — `service_type — canonical values`

M7, from `src/shared/utils/service-type-labels.ts:3-14`:

> The canonical service-type codes are `WSIR`, `IRON`, `DRCL`, and `WASH`. Frontend presentation is centralized in `src/shared/utils/service-type-labels.ts`, which supplies the Thai label and icon used by price-list, invoice, and order UI. Update that map when wording changes instead of adding a feature-local copy.

### `docs/features/orders/overview.md` — `SHARED GAPS`

M8, from `src/shared/stores/selected-customer.store.ts:6-17`:

> `useSelectedCustomerStore` is the cross-feature handoff from customer selection to appointment booking. `select()` accepts contract-derived customer fields plus legacy card fields, keeps a nonblank map location, and falls back to a nonblank postal address only when location is absent. If both are unusable, it leaves `location` null rather than inventing a value; the store is handoff state, not picker UI.

## Missing documents

No entirely new document is required. Every verified MOVE topic has a reasonable existing owner:

- Cache persistence failure: data-fetching convention.
- Bangkok civil-date and scheduling semantics: datetime convention.
- List search ownership: list-page pattern.
- Service-type presentation ownership: order data model.
- Selected-customer cross-feature handoff: orders/shared-gap documentation.

The unverified topics should not be moved until their claims are independently confirmed.

## UNVERIFIED findings

1. `src/shared/api/api-client.ts:6-18` — the full claim depends on `api/CLAUDE.md` and call-site behavior not present in the listed document set.
2. `src/shared/config/cache.ts:17-30` — the “raise TTL after real-world use” instruction has no documentary evidence; `docs/plans/cache-gateway.md:131-134` is also internally inconsistent.
3. `src/shared/config/cache.ts:52-59` — the issue-report reporter’s use of `localStorage` is not verified by the listed docs.
4. `src/shared/components/BaseSwipeCard.vue:81-90` — the browser compatibility-click explanation lacks runtime browser verification; only static source tests were found.
5. `src/shared/config/actor.ts:4-10` — the `?by=<name>` behavior is implemented, but the claimed AppSheet backward-compatibility origin is not established by current source or docs.

---

# Part 2 — `src/features/` audit

Produced 2026-09-12, seven explorers, one per feature area. `gallery` excluded (unmerged work on
another branch) and `issue-reports` excluded (it has no doc comments at all).

**134 blocks, 370 comment lines.** Totals agree with the table this time.

| Verdict | Blocks |
|---|---:|
| DELETE | 45 |
| KEEP | 26 |
| ALREADY-DOCUMENTED | 28 |
| MOVE | 15 |
| STALE | 12 |
| UNVERIFIED | 8 |

Every MOVE has an existing destination document — no new document is required, despite
`docs/features/` covering only orders.

## Claude's verification of Part 2

Spot-checked three claims against the real code.

- `CustomerCard.vue:41-43` **CONFIRMED STALE.** It says "one of three writers" of the
  selected-customer store. `.select()` is actually called from `CustomerCard.vue:45`,
  `OrderHistoryCustomerCard.vue:23`, `CustomerDetailPage.vue:128` and `:139`, and
  `InvoiceCreatePage.vue:273` — five calls in four files. A textbook drift: true when written,
  wrong after two more call sites appeared.
- `app-boot.md:47` **CONFIRMED WRONG, and this one is in `docs/`, not in code.** It states that
  `appointment-api.schema.ts:88-102` "already accepts `dateFrom` / `dateTo`". The schema defines
  `keyword`, `customerId`, `appointmentDate`, `status`, `page`, `perPage`, `sortBy`, `sortOrder`
  — and no date range. This document was merged unreviewed in `ccf187a`, which is exactly the
  reason the ALREADY-DOCUMENTED rows in Part 1 are blocked.
- `invoice.service.ts:15` **DISPUTED — do not treat as STALE.** The comment says `items.length` is
  a page count and not a dataset total. That is an accurate description of the code at `:27`. What
  actually conflicts is the *behaviour* versus `docs/design/patterns/list-pages.md — ## Pagination`.
  So this is a real defect the comment honestly flags, not a false comment. Delete the comment
  because prose belongs in docs, but record the pagination defect rather than losing it.

Treat the remaining nine STALE rows as unverified claims until checked the same way.

Completed the read-only audit. All seven explorers returned successfully in the required batches; no files were created or modified, and no git commands were run.

## STALE findings

| Path:line | Claim | Evidence |
|---|---|---|
| `src/features/invoices/pages/InvoiceCreatePage.vue:62-68` | Invoice-number format and example | Code emits ``INV${yy}${mm}${digits}`` at `:77`, with eight random digits; the comment’s example is inconsistent. |
| `src/features/invoices/services/invoice.service.ts:15` | Current-page length is the dataset total | Code sets `total: items.length` at `:27`, conflicting with `docs/design/patterns/list-pages.md` — `## Pagination`. |
| `src/features/invoices/services/invoice-price-list.service.ts:18-22` | `perPage: 1000` is a sufficient bound | Code uses `perPage: 1000` at `:26`; `docs/conventions/data-fetching.md` — `## Bounded queries` says `perPage` alone is not a real bound. |
| `src/features/invoices/types/invoice-create.types.ts:8-20` | Legacy invoice types are avoided because of status incompatibility | Current contracts define `status: invoiceStatusSchema` at `server/sheets/Invoices/Invoices.db-contract.ts:11` and include `UNPAID`/`PAID` at `contracts/invoices/invoice-api.schema.ts:10-15`. |
| `src/features/invoices/utils/invoice-price-list.utils.ts:165-170` | Predicate identifies an untouched placeholder | Code checks only fields at `:173-177`; it does not check `unit` or `unitOption`, so “untouched” is overstated. |
| `src/features/orders/composables/use-corner-editor.ts:64-65` | Mismatch path is dead | No mismatch branch exists; `:62` and `:66-68` only default or scale-map the quad. |
| `src/features/customers/components/CustomerCard.vue:41-43` | This is one of three shared-store writers | Current calls occur at `OrderHistoryCustomerCard.vue:23`, `CustomerDetailPage.vue:128,139`, and `InvoiceCreatePage.vue:273`: five calls across four files. |
| `src/features/customer-packages/stores/customer-package-purchase.store.ts:61` | Package invoice uses a three-day payment term | `InvoiceCreatePage.vue:86-89` shows the three-day value belongs to the existing invoice form and may be shortened. |
| `src/features/customer-packages/components/CustomerPackageExtraFilter.vue:21-22` | Trigger is beside the create button | Trigger is in `#search-actions` at `CustomerPackageListPage.vue:28-30`; create button is separately in `#actions` at `:32-41`. |
| `src/features/packages/services/package.service.ts:34` | Customer-package data depends on the Packages catalog | Assembly at `server/modules/customer-packages/customer-package-assembly.ts:90` maps package fields but does not return price; the comment’s stated dependency is inaccurate. |
| `src/features/packages/services/package.service.ts:48` | Same dependency claim on update | Same evidence: `server/modules/customer-packages/customer-package-assembly.ts:90`; invalidation occurs at `package.service.ts:49`. |
| `src/features/price-list/components/PriceListServiceFilter.vue:23-24` | Trigger is beside the create button | Trigger is in `#search-actions` at `PriceListPage.vue:119-125`; create button is separately in `#actions` at `:127-139`. |

Additional documentation conflict found: `docs/architecture/frontend/app-boot.md:47` says the appointment schema accepts `dateFrom`/`dateTo`, but `contracts/appointments/appointment-api.schema.ts:88-102` does not define them.

## Consolidated block table

| Scope | Path:line-range | Lines | Verdict | Claim and evidence |
|---|---|---:|---|---|
| Invoices pages/components | `src/features/invoices/pages/InvoiceCreatePage.vue:2-7` | 6 | ALREADY-DOCUMENTED | Page owns form workflow; child components are presentational. Evidence: `docs/architecture/frontend/feature-structure.md` — `## Dependency Direction`; `docs/design/patterns/forms.md` — `## Form Boundary`. |
| Invoices pages/components | `src/features/invoices/pages/InvoiceCreatePage.vue:62-68` | 7 | STALE | Invoice-number format is inconsistent with ``INV${yy}${mm}${digits}`` at `:77`. |
| Invoices pages/components | `src/features/invoices/pages/InvoiceCreatePage.vue:86-89` | 4 | DELETE | Due-date initialization and watcher behavior are visible at `:90`, `:92-99`, and `:183`. |
| Invoices pages/components | `src/features/invoices/pages/InvoiceCreatePage.vue:97` | 1 | DELETE | `gapDays` and `dueDate.value` are directly implemented at `:98-99`. |
| Invoices pages/components | `src/features/invoices/pages/InvoiceCreatePage.vue:137` | 1 | DELETE | Filtering is explicit: `.filter((a) => a.label && Number.isFinite(a.value) && a.value !== 0)` at `:147`. |
| Invoices pages/components | `src/features/invoices/pages/InvoiceCreatePage.vue:156` | 1 | ALREADY-DOCUMENTED | Shared runtime calculation. Evidence: `docs/architecture/frontend/project-structure.md` — `## Shared Runtime Layer`; `docs/architecture/frontend/feature-structure.md` — `## Placement Rule`. |
| Invoices pages/components | `src/features/invoices/pages/InvoiceCreatePage.vue:178-179` | 2 | DELETE | Validity conditions are implemented by `items.value.every(...)` and field checks at `:185-190`. |
| Invoices pages/components | `src/features/invoices/pages/InvoiceCreatePage.vue:297-298` | 2 | ALREADY-DOCUMENTED | Retry eligibility follows persistence certainty. Evidence: `docs/architecture/backend/operations.md` — `## Sheets writes and certainty`. |
| Invoices pages/components | `src/features/invoices/pages/InvoiceCreatePage.vue:308-310` | 3 | ALREADY-DOCUMENTED | Lost responses are unknown, not rejected. Evidence: same heading in `docs/architecture/backend/operations.md`. |
| Invoices pages/components | `src/features/invoices/pages/InvoiceCreatePage.vue:388` | 1 | DELETE | Branch is explicit: `<div v-else-if="!order || !customer">` at `:389`. |
| Invoices pages/components | `src/features/invoices/pages/InvoiceCreatePage.vue:404` | 1 | ALREADY-DOCUMENTED | Create returns six outcome kinds. Evidence: `docs/architecture/backend/service-layer.md` — `## Responsibilities`. |
| Invoices pages/components | `src/features/invoices/pages/InvoiceCreatePage.vue:460-463` | 4 | DELETE | Retry branch is explicit at `:465`: `result.kind === 'items_write_failed' && canRetry`. |
| Invoices pages/components | `src/features/invoices/pages/InvoiceCreatePage.vue:479-484` | 6 | ALREADY-DOCUMENTED | Unknown write outcomes do not offer retry. Evidence: `docs/architecture/backend/operations.md` — `## Sheets writes and certainty`. |
| Invoices pages/components | `src/features/invoices/components/InvoiceDateFilter.vue:8-9` | 2 | KEEP | Loading suppresses the panel while the toggle remains reachable. Reduced form: `// Keep this control disabled while ListContainer suppresses content slots during loading, so aria-expanded still describes a rendered panel.` |
| Invoices pages/components | `src/features/invoices/components/InvoiceDatePanel.vue:14-15` | 2 | UNVERIFIED | Could not verify the cross-browser claim that native date inputs fire one change per keystroke. |
| Invoices pages/components | `src/features/invoices/components/InvoiceDatePanel.vue:62-64` | 3 | KEEP | Panel must remain across list states. Reduced form: `// Keep the date panel in default, empty, and error slots because ListContainer renders only the active content slot.` |
| Invoices pages/components | `src/features/invoices/components/InvoiceFilterBar.vue:12-13` | 2 | DELETE | Filter composition is visible at `InvoiceListPage.vue:94-99`. |
| Invoices pages/components | `src/features/invoices/components/InvoiceAdjustmentsEditor.vue:2-7` | 6 | ALREADY-DOCUMENTED | Presentational component communicates through props/events. Evidence: `docs/architecture/frontend/feature-structure.md` — `## Dependency Direction`; `docs/conventions/components.md` — `## Rules`. |
| Invoices pages/components | `src/features/invoices/components/InvoiceAdjustmentsEditor.vue:13-14` | 2 | DELETE | Compact layout is expressed by `:class="compact ? '' : 'sm:items-center'"` at `:57`. |
| Invoices pages/components | `src/features/invoices/components/InvoiceLineItemsEditor.vue:5` | 1 | ALREADY-DOCUMENTED | Presentational component emits actions. Evidence: `docs/conventions/components.md` — `## Rules`. |
| Invoices pages/components | `src/features/invoices/components/InvoiceTotalsPreview.vue:2-6` | 5 | ALREADY-DOCUMENTED | Page computes totals; component displays values. Evidence: `docs/architecture/frontend/project-structure.md` — `## Shared Runtime Layer`; `docs/architecture/frontend/feature-structure.md` — `## Placement Rule`. |
| Invoices pages/components | `src/features/invoices/components/InvoicePriceListPicker.vue:221-222` | 2 | KEEP | Local 32px icon sizing exceeds shared rules. Reduced form: `// Keep the local 32px icon rule because shared Material Symbols size overrides stop at 28px.` |
| Invoices services/stores/types/utils/composables | `src/features/invoices/services/invoice.service.ts:15-18` | 4 | STALE | Uses current-page length as total; code is `total: items.length` at `:27`. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/services/invoice.service.ts:33-53` | 21 | MOVE | Invoice creation returns a top-level outcome union. Destination: `docs/conventions/contracts/api.md` — `## Rules`. Draft: “`POST /api/invoices` returns the `CreateInvoiceResponse` discriminated union directly, rather than the standard `{ success, data, meta }` envelope. The client reads and validates the body even for non-OK statuses and maps an unrecognized body to an `items_write_failed` outcome with `certainty: 'unknown'`.” |
| Invoices services/stores/types/utils/composables | `src/features/invoices/services/invoice.service.ts:74` | 1 | MOVE | ORDER invoice creation updates the source work order; CYCLE invoices do not. Destination: `docs/architecture/backend/operations.md` — `## Sheets writes and certainty`. Draft: “`ORDER` invoice creation writes the invoice number into the source `OrderForm.invoice_id` after the invoice items and header are recorded. `CYCLE` invoices have no source order and skip this linkage stage.” |
| Invoices services/stores/types/utils/composables | `src/features/invoices/services/invoice-detail.service.ts:16` | 1 | DELETE | Input validation is explicit: `const parsed = invoiceNumberSchema.safeParse(input)` at `:18`. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/services/invoice-detail.service.ts:23` | 1 | MOVE | Missing detail returns `null`; other failures propagate. Destination: `docs/conventions/contracts/api.md` — `## Boundary`. Draft: “`getInvoiceDetail` returns `null` when the requested invoice is not found. Other lookup failures remain errors.” |
| Invoices services/stores/types/utils/composables | `src/features/invoices/services/invoice-price-list.service.ts:14` | 1 | DELETE | Truncation is explicit: `items.length === 1000` at `:34`. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/services/invoice-price-list.service.ts:18-22` | 5 | STALE | `perPage: 1000` at `:26` is not a complete bound under `docs/conventions/data-fetching.md` — `## Bounded queries`. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/stores/invoice.store.ts:14` | 1 | KEEP | Reduced form: `// Ignore stale responses from superseded requests.` |
| Invoices services/stores/types/utils/composables | `src/features/invoices/stores/invoice-price-list.store.ts:30` | 1 | DELETE | Filtering is explicit: `items.value = result.items.filter((item) => item.active === true)` at `:31`. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/types/invoice-create.types.ts:4-5` | 2 | DELETE | Inferred alias is colocated with its schema: `type InvoiceAdjustmentCalculation = z.infer<...>` at `:6`. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/types/invoice-create.types.ts:8-20` | 13 | STALE | Current DB/API contracts use `invoiceStatusSchema`, including `UNPAID` and `PAID`. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/types/invoice-create.types.ts:23` | 1 | UNVERIFIED | Could not inspect the excluded page payload builder to verify that `key` is never submitted. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/types/invoice-create.types.ts:27` | 1 | UNVERIFIED | Could not inspect excluded page code to verify submit-time numeric parsing and zero/blank filtering. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/types/invoice-create.types.ts:33-34` | 2 | DELETE | Unit options are explicit at `:35`: `invoiceUnitOptions = [...]`. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/types/invoice-create.types.ts:46-51` | 6 | KEEP | Reduced form: `// Marker identifies the seeded empty-order placeholder.` |
| Invoices services/stores/types/utils/composables | `src/features/invoices/types/invoice-create.types.ts:78` | 1 | UNVERIFIED | Could not verify the excluded callers invoke the factory only for zero-item orders. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/utils/invoice-outcome.utils.ts:3-7` | 5 | ALREADY-DOCUMENTED | Retry safety follows certainty. Evidence: `docs/architecture/backend/operations.md` — `## Sheets writes and certainty`. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/utils/invoice-outcome.utils.ts:15` | 1 | ALREADY-DOCUMENTED | Unknown certainty is not retry-safe. Evidence: same heading. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/utils/invoice-price-list.utils.ts:18-19` | 2 | DELETE | Shared presentation mapping is explicit at `:20-21`: `SERVICE_PRESENTATION = serviceTypePresentation`. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/utils/invoice-price-list.utils.ts:46-49` | 4 | DELETE | Icon hints and fallback are explicit at `:50-63`. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/utils/invoice-price-list.utils.ts:165-170` | 6 | STALE | Predicate omits `unit` and `unitOption`, so “untouched” is inaccurate. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/utils/invoice-price-list.utils.ts:181-188` | 8 | UNVERIFIED | Could not verify from excluded callers that order-seeded rows never carry the synthetic marker. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/composables/useInvoiceItemPickerRoute.ts:6-17` | 12 | ALREADY-DOCUMENTED | Query-owned overlay push/back/replace rules. Evidence: `docs/conventions/navigation.md` — `## Route-owned overlays`. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/composables/useInvoiceItemPickerRoute.ts:28` | 1 | ALREADY-DOCUMENTED | Back is used only for entries pushed by the page. Evidence: same heading. |
| Invoices services/stores/types/utils/composables | `src/features/invoices/composables/useInvoiceFilterRoute.ts:38-42` | 5 | MOVE | Invoice filters derive from and serialize to route query state. Destination: `docs/design/patterns/list-pages.md` — `## Filters`. Draft: “Durable invoice filters are derived from the route query and written with router.replace. Serializing the default filter omits default-valued entries so the default state has a clean empty query.” |
| Invoices services/stores/types/utils/composables | `src/features/invoices/composables/useInvoiceFilterRoute.ts:89` | 1 | DELETE | Vue Router values are normalized at `:91-92` for arrays, null, and undefined. |
| Orders | `src/features/orders/order-status-presentation.ts:9` | 1 | ALREADY-DOCUMENTED | Unknown statuses use a neutral fallback. Evidence: `docs/features/orders/order-list-screen.md` — `## Status labels`. |
| Orders | `src/features/orders/stores/order.store.ts:49-53` | 5 | MOVE | List data seeds the detail header while detail loads. Destination: `docs/features/orders/order-detail-screen.md` — `## Caching`. Draft: “When the list already contains an order, the detail store seeds the header from that row while the detail request is in flight. It preserves an existing detail object for the same order so a refresh does not replace loaded items with an empty seed.” |
| Orders | `src/features/orders/services/order-price-list.service.ts:15` | 1 | MOVE | Price-list result can be truncated at 1,000 rows. Destination: `docs/features/orders/order-item-form.md` — `## Fields`. Draft: “The price-list picker requests up to 1,000 catalogue rows. When the result reaches that limit, the picker marks the catalogue as truncated and tells staff that search covers only the loaded rows.” |
| Orders | `src/features/orders/pages/OrderDetailPage.vue:68-70` | 3 | MOVE | Document and camera overlays are mutually exclusive. Destination: `docs/features/orders/forms/create-order-image.md` — `## Overlay behaviour`. Draft: “On the order detail page, DOCUMENT uses `DocumentScannerOverlay`; WEIGHT and BELONGING use the shared `CameraOverlay`. The page passes `open=false` to the inactive overlay so only one camera stream can run at a time.” |
| Orders | `src/features/orders/pages/OrderCreatePage.vue:25-26` | 2 | UNVERIFIED | `todaySheetDate()` is verified at `:27`, but the business claim that intake is nearly always logged the same day is not verifiable from permitted sources. |
| Orders | `src/features/orders/composables/use-corner-editor.ts:64-65` | 2 | STALE | No mismatch branch exists at `:62` or `:66-68`. |
| Orders | `src/features/orders/composables/use-document-detect.ts:40-45` | 6 | KEEP | Reduced form: `// Preserve fractional letterbox offsets so unmapping stays aligned with the rendered outline.` |
| Orders | `src/features/orders/composables/use-document-detect.ts:59-64` | 6 | DELETE | Coordinate transformation is directly implemented at `:67-68` using `point.x - layout.offsetX` and `1 / layout.scale`. |
| Orders | `src/features/orders/composables/use-document-detect.ts:210-212` | 3 | DELETE | `letterboxLayout` is called and its dimensions/offsets used at `:213-227`. |
| Orders | `src/features/orders/composables/use-document-detect.ts:239-241` | 3 | DELETE | `unmapLetterboxedQuad` is directly called at `:242-245`. |
| Orders | `src/features/orders/composables/use-document-detect.ts:282-283` | 2 | DELETE | Getter and `toValue` mechanics are visible at `:284-287`. |
| Orders | `src/features/orders/composables/use-order-overlay-route.ts:28` | 1 | MOVE | Legacy item deep links remain readable. Destination: `docs/features/orders/order-item-form.md` — `## Overlay`. Draft: “The canonical overlay query is `orderAction=item`, but the reader continues to accept `?item=new` for existing deep links. New links should write only the canonical key.” |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:44-47` | 4 | MOVE | Scanner state machine. Destination: `docs/features/orders/forms/create-order-image.md` — `## Scanner state machine`. Draft: “The document scanner moves from `viewfinder` to `capturing` to `adjusting` to `warping`, then returns to `viewfinder` after success. Capture failures return to `viewfinder`; warp failures return to `adjusting` with the captured still preserved.” |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:218` | 1 | DELETE | Outline-drawing section is apparent from `updateVideoDimensions` at `:220`. |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:255-256` | 2 | MOVE | Outline is hidden when detection has no usable quad. Destination: `docs/features/orders/forms/create-order-image.md` — `## Document detection`. Draft: “The live document outline is drawn only when detection produces a usable quadrilateral. A miss clears the outline so the UI does not imply that detection succeeded.” |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:382-385` | 4 | KEEP | Reduced form: `// Camera restarts only from the viewfinder watchEffect, and cameraError blocks retry loops.` |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:413-421` | 9 | KEEP | Reduced form: `// Loupe sampling and overlay use image-pixel coordinates; box.scale converts image pixels to loupe pixels.` |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:446-447` | 2 | KEEP | Reduced form: `// Keep the alignment guide thin so it does not obscure the paper edge.` |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:456-457` | 2 | KEEP | Reduced form: `// Leave a centre gap so the crosshair does not cover the active point.` |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:470` | 1 | KEEP | Reduced form: `// Draw the dark pass first to keep the crosshair legible on pale paper.` |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:558-559` | 2 | DELETE | Capture state is derived at `:63-64` and set to `capturing` at `:560`. |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:581-583` | 3 | DELETE | `stopCameraStream()` and stage change are explicit at `:584-585`. |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:587-590` | 4 | KEEP | Reduced form: `// On capture failure, keep the live stream and reset the captured state before returning to viewfinder.` |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:604` | 1 | DELETE | Warp handling is apparent from `createWarpedDocumentFile` at `:606`. |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:620-621` | 2 | UNVERIFIED | Current `enhance` call is at `:622`; historical default and unchanged-output claim could not be checked. |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:634` | 1 | DELETE | `warping` state is set at `:635`; disabled bindings are at `:805` and `:813`. |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:644-645` | 2 | DELETE | Cleanup, emit, release, and return to viewfinder occur at `:646-648`. |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:650-651` | 2 | KEEP | Reduced form: `// Preserve the captured still and corners after a warp failure so the user can retry.` |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:659-660` | 2 | DELETE | Retake cleanup and restart occur at `:661-663`. |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:701-703` | 3 | ALREADY-DOCUMENTED | Child overlay does not own navigation or route state. Evidence: `docs/conventions/navigation.md` — `## Route-owned overlays`. |
| Orders | `src/features/orders/components/DocumentScannerOverlay.vue:755-757` | 3 | UNVERIFIED | Current layout is at `:758`; historical reason involving a removed filter strip could not be checked. |
| Customers | `src/features/customers/utils/waiting-pickup.filter.ts:10-14` | 5 | MOVE | Client-side waiting-pickup filtering and soft-delete limitation. Destination: `docs/conventions/data-fetching.md` — `## Bounded queries`. Draft: “The appointments list API exposes an exact `appointmentDate` filter but no `deletedAt` or date-range filter. Waiting-pickup filtering therefore remains client-side; soft-deleted rows may appear, so this helper is not a deletion-correctness boundary.” |
| Customers | `src/features/customers/stores/customer.store.ts:5` | 1 | ALREADY-DOCUMENTED | Full customer list is cached; filters remain in URL query. Evidence: `docs/conventions/data-fetching.md` — `## Cache policy`; `docs/design/patterns/list-pages.md` — `## Filters`. |
| Customers | `src/features/customers/stores/customer.store.ts:7-8` | 2 | KEEP | Reduced form: `// List is replaced wholesale; shallowRef avoids per-customer proxies.` |
| Customers | `src/features/customers/stores/customer.store.ts:14` | 1 | MOVE | Cache is reused unless forced or invalidated. Destination: `docs/conventions/data-fetching.md` — `## Cache policy`. Draft: “`useCustomerStore` caches the full customer list and skips subsequent loads unless `force` is true. Set `force: true` or call `invalidate()` when the next load must refetch.” |
| Customers | `src/features/customers/stores/customer.store.ts:30` | 1 | DELETE | `invalidate()` resets the flag via `loaded.value = false` at `:32`. |
| Customers | `src/features/customers/services/waiting-pickup.service.ts:13` | 1 | DELETE | Service returns raw data: `return items` at `:19`; filtering is elsewhere. |
| Customers | `src/features/customers/services/customer.service.ts:9` | 1 | ALREADY-DOCUMENTED | DTOs are contract-derived camelCase values. Evidence: `docs/architecture/frontend/feature-structure.md` — `## Dependency Direction`; `docs/conventions/coding.md` — `## TypeScript`. |
| Customers | `src/features/customers/services/customer.service.ts:11-12` | 2 | ALREADY-DOCUMENTED | Query/DTO types come directly from shared contracts. Evidence: same headings. |
| Customers | `src/features/customers/services/customer.service.ts:19` | 1 | DELETE | List fetch is explicit at `:23`: `apiGetList<CustomerListDto>(CUSTOMERS_ENDPOINT, ...)`. |
| Customers | `src/features/customers/services/customer.service.ts:30` | 1 | DELETE | Single-customer fetch directly calls `apiGet('/api/customers/:id')` at `:31-32`. |
| Customers | `src/features/customers/pages/CustomerListPage.vue:19-20` | 2 | KEEP | Reduced form: `// Count tabs from the full list, independent of active filters.` |
| Customers | `src/features/customers/pages/CustomerListPage.vue:29` | 1 | KEEP | Reduced form: `// Apply filters to the loaded list; filter changes do not refetch.` |
| Customers | `src/features/customers/pages/CustomerDetailPage.vue:100` | 1 | KEEP | Reduced form: `// Block repeat submission until the refreshed package balance arrives.` |
| Customers | `src/features/customers/composables/useOrderSheetRoute.ts:10` | 1 | ALREADY-DOCUMENTED | URL query owns sheet state. Evidence: `docs/conventions/navigation.md` — `## Route-owned overlays`. |
| Customers | `src/features/customers/composables/useOrderSheetRoute.ts:17-19` | 3 | ALREADY-DOCUMENTED | `router.back()` is limited to page-pushed entries; deep links use replacement. Evidence: same heading. |
| Customers | `src/features/customers/composables/useCustomerFilterRoute.ts:7` | 1 | MOVE | Filter state is URL-owned and defaults are omitted. Destination: `docs/design/patterns/list-pages.md` — `## Filters`. Draft: “Customer list filters are route-owned query state: derive them from `route.query` and update them with `router.replace`. Omit default values when serializing the query.” |
| Customers | `src/features/customers/composables/useCustomerFilterRoute.ts:55` | 1 | DELETE | Helper explicitly handles arrays, null, and missing values at `:56-58`. |
| Customers | `src/features/customers/components/CustomerTypeTabs.vue:6-10` | 5 | ALREADY-DOCUMENTED | Presentational, prop-driven, and emits selection. Evidence: `docs/conventions/components.md` — `### Feature Components` and `## Rules`. |
| Customers | `src/features/customers/components/CustomerCard.vue:41-43` | 3 | STALE | Shared-store writer count is contradicted by five calls across four files. |
| Customer-packages | `src/features/customer-packages/stores/customer-package-purchase.store.ts:36-37` | 2 | KEEP | Reduced form: `// Preserve each customer's attempt so resume reuses the same invoice request.` |
| Customer-packages | `src/features/customer-packages/stores/customer-package-purchase.store.ts:45-48` | 4 | MOVE | CYCLE invoice periods are required. Destination: `docs/conventions/contracts/api.md` — `## Rules`. Draft: “CYCLE invoices must carry both `billingPeriodStart` and `billingPeriodEnd`; customer-package purchases derive them from the package’s `startDate` and `expiryDate`. Reject the purchase before invoice creation when either date is absent.” |
| Customer-packages | `src/features/customer-packages/stores/customer-package-purchase.store.ts:61` | 1 | STALE | Three-day payment-term claim is not the package-purchase behavior. |
| Customer-packages | `src/features/customer-packages/services/customer-package.service.ts:51-56` | 6 | MOVE | GViz may coerce numeric-looking identifiers to numbers and lose leading zeroes. Destination: `docs/architecture/backend/persistence.md` — `## Reads`. Draft: “GViz may return numeric-looking identifier cells as numbers. Normalizing them to strings restores the DTO type but cannot restore a lost leading zero; columns requiring that digit must be stored as Plain Text.” |
| Customer-packages | `src/features/customer-packages/services/customer-package.service.ts:108-112` | 5 | ALREADY-DOCUMENTED | Unknown write outcomes must not be retried unsafely. Evidence: `docs/architecture/backend/operations.md` — `## Sheets writes and certainty`. |
| Customer-packages | `src/features/customer-packages/services/customer-package.service.ts:123-124` | 2 | DELETE | Response union is defined by the schema and returned via `createCustomerPackageResponseSchema` at `:137-142`; schema union: `contracts/customer-packages/customer-package-api.schema.ts:36-41`. |
| Customer-packages | `src/features/customer-packages/services/customer-package.service.ts:158-159` | 2 | DELETE | Response union is parsed and returned at `:172-177`; schema union: `contracts/customer-packages/customer-package-api.schema.ts:23-28`. |
| Customer-packages | `src/features/customer-packages/components/CustomerPackageExtraFilter.vue:8-9` | 2 | KEEP | Reduced form: `// Disable this trigger while ListContainer suppresses the content slot during loading.` |
| Customer-packages | `src/features/customer-packages/components/CustomerPackageExtraFilter.vue:21-22` | 2 | STALE | Trigger is in `#search-actions`, not beside create button. |
| Customer-packages | `src/features/customer-packages/preview/variant-c/VariantC.vue:69` | 1 | DELETE | CSS directly declares `font-family: 'Material Symbols Outlined'` at `:70`. |
| Customer-packages | `src/features/customer-packages/pages/CustomerPackageCreatePage.vue:26-27` | 2 | KEEP | Reduced form: `// With customerId, the parent owns overlay navigation; without it, this page is standalone.` |
| Customer-packages | `src/features/customer-packages/pages/CustomerPackageDetailPage.vue:56-58` | 3 | KEEP | Reduced form: `// Read the actor at submit time because KeepAlive cannot make window.location.hash reactive.` |
| Customer-packages | `src/features/customer-packages/composables/useCustomerPackageTransactionRoute.ts:10` | 1 | ALREADY-DOCUMENTED | Route-owned overlay state enables browser Back dismissal. Evidence: `docs/conventions/navigation.md` — `## Route-owned overlays`. |
| Customer-packages | `src/features/customer-packages/composables/useCustomerPackageTransactionRoute.ts:16-17` | 2 | ALREADY-DOCUMENTED | Deep-link dismissal uses replace. Evidence: same heading. |
| Appointments | `src/features/appointments/stores/appointment.store.ts:18-22` | 5 | KEEP | Reduced form: `// Reconcile schedule and pending views from persisted write responses because GViz reads may lag.` |
| Appointments | `src/features/appointments/stores/appointment.store.ts:53` | 1 | DELETE | API date filter and client filtering/sorting are visible at `:54` and `:59-60`. |
| Appointments | `src/features/appointments/stores/appointment.store.ts:57` | 1 | KEEP | Reduced form: `// Keep PENDING appointments out of the daily schedule; they belong in the pending queue.` |
| Appointments | `src/features/appointments/stores/appointment.store.ts:151-155` | 5 | ALREADY-DOCUMENTED | API date filtering and GViz normalization. Evidence: `docs/architecture/frontend/app-boot.md` — `## Network at boot`; `docs/conventions/datetime.md` — `## Read side`. |
| Appointments | `src/features/appointments/services/appointment.service.ts:30` | 1 | ALREADY-DOCUMENTED | API-classified certainty. Evidence: `docs/architecture/backend/operations.md` — `## Sheets writes and certainty`. |
| Appointments | `src/features/appointments/services/appointment.service.ts:43` | 1 | ALREADY-DOCUMENTED | Retry depends on rejected versus unknown certainty. Evidence: same heading. |
| Appointments | `src/features/appointments/services/appointment.service.ts:54` | 1 | DELETE | `apiGetList` receives `query` and `querySchema` at `:55-59`. |
| Appointments | `src/features/appointments/services/appointment.service.ts:62` | 1 | DELETE | Reschedule route is visible at `src/features/appointments/routes.ts:21-24`. |
| Appointments | `src/features/appointments/services/appointment.service.ts:76` | 1 | DELETE | Create passes `requestSchema: createAppointmentRequestSchema` at `:80-83`. |
| Appointments | `src/features/appointments/services/appointment.service.ts:88` | 1 | DELETE | Update passes `requestSchema: updateAppointmentRequestSchema` at `:93-99`. |
| Appointments | `src/features/appointments/services/appointment.service.ts:110-114` | 5 | KEEP | Reduced form: `// Preserve appointment write certainty locally because the shared write client exposes only generic ApiError.` |
| Appointments | `src/features/appointments/services/appointment.service.ts:153` | 1 | DELETE | Parsing fallback and generic `ApiError` are visible at `:135-156`. |
| Appointments | `src/features/appointments/pages/CreateAppointmentPage.vue:23` | 1 | ALREADY-DOCUMENTED | Uncached form page uses `onMounted`. Evidence: `docs/design/patterns/forms.md` — `## State`. |
| Price-list/packages | `src/features/packages/services/package.service.ts:34-34` | 1 | STALE | Catalog dependency claim is contradicted by the assembly behavior at `server/modules/customer-packages/customer-package-assembly.ts:90`. |
| Price-list/packages | `src/features/packages/services/package.service.ts:48-48` | 1 | STALE | Same contradiction on update; invalidation is at `:49`. |
| Price-list/packages | `src/features/price-list/pages/PriceListPage.vue:65-66` | 2 | DELETE | `activeItems` and `inactiveItems` are created at `:67-68`; both render at `:166-175`. |
| Price-list/packages | `src/features/price-list/pages/PriceListPage.vue:134-136` | 3 | DELETE | Accessible label at `:131` and `new_label` icon at `:137` express the behavior. |
| Price-list/packages | `src/features/price-list/pages/PriceListFormPage.vue:141-144` | 4 | DELETE | Separate payload branches are explicit at `:145-149`; distinct schemas are at `contracts/price-list/price-list-api.schema.ts:71-75`. |
| Price-list/packages | `src/features/price-list/components/PriceListServicePanel.vue:14-16` | 3 | KEEP | Reduced form: `// Keep the filter panel in default, empty, and error slots so it remains clearable in every list state.` |
| Price-list/packages | `src/features/price-list/components/PriceListServiceFilter.vue:8-9` | 2 | KEEP | Reduced form: `// Disable while loading because ListContainer hides the panel content.` |
| Price-list/packages | `src/features/price-list/components/PriceListServiceFilter.vue:23-24` | 2 | STALE | Trigger is in `#search-actions`; create button is in `#actions`. |
| Price-list/packages | `src/features/price-list/components/PriceListCard.vue:41-42` | 2 | DELETE | Status dot and accessible label are rendered at `:43-47`. |

## Totals

| Verdict | Blocks | Comment lines |
|---|---:|---:|
| DELETE | 45 | — |
| ALREADY-DOCUMENTED | 28 | — |
| MOVE | 15 | — |
| KEEP | 26 | — |
| STALE | 12 | — |
| UNVERIFIED | 8 | — |
| **Total** | **134** | **370** |

## Per-file breakdown

| File | Blocks | Lines | DELETE | ALREADY | MOVE | KEEP | STALE | UNVERIFIED |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `src/features/invoices/pages/InvoiceCreatePage.vue` | 13 | 39 | 6 | 6 | 0 | 0 | 1 | 0 |
| `src/features/invoices/components/InvoiceDateFilter.vue` | 1 | 2 | 0 | 0 | 0 | 1 | 0 | 0 |
| `src/features/invoices/components/InvoiceDatePanel.vue` | 2 | 5 | 0 | 0 | 0 | 1 | 0 | 1 |
| `src/features/invoices/components/InvoiceFilterBar.vue` | 1 | 2 | 1 | 0 | 0 | 0 | 0 | 0 |
| `src/features/invoices/components/InvoiceAdjustmentsEditor.vue` | 2 | 8 | 1 | 1 | 0 | 0 | 0 | 0 |
| `src/features/invoices/components/InvoiceLineItemsEditor.vue` | 1 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| `src/features/invoices/components/InvoiceTotalsPreview.vue` | 1 | 5 | 0 | 1 | 0 | 0 | 0 | 0 |
| `src/features/invoices/components/InvoicePriceListPicker.vue` | 1 | 2 | 0 | 0 | 0 | 1 | 0 | 0 |
| `src/features/invoices/services/invoice.service.ts` | 3 | 26 | 0 | 0 | 2 | 0 | 1 | 0 |
| `src/features/invoices/services/invoice-detail.service.ts` | 2 | 2 | 1 | 0 | 1 | 0 | 0 | 0 |
| `src/features/invoices/services/invoice-price-list.service.ts` | 2 | 6 | 1 | 0 | 0 | 0 | 1 | 0 |
| `src/features/invoices/stores/invoice.store.ts` | 1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| `src/features/invoices/stores/invoice-price-list.store.ts` | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| `src/features/invoices/types/invoice-create.types.ts` | 7 | 26 | 2 | 0 | 0 | 1 | 1 | 3 |
| `src/features/invoices/utils/invoice-outcome.utils.ts` | 2 | 6 | 0 | 2 | 0 | 0 | 0 | 0 |
| `src/features/invoices/utils/invoice-price-list.utils.ts` | 4 | 20 | 2 | 0 | 0 | 0 | 1 | 1 |
| `src/features/invoices/composables/useInvoiceItemPickerRoute.ts` | 2 | 13 | 0 | 2 | 0 | 0 | 0 | 0 |
| `src/features/invoices/composables/useInvoiceFilterRoute.ts` | 2 | 6 | 1 | 0 | 1 | 0 | 0 | 0 |
| `src/features/orders/stores/order.store.ts` | 1 | 5 | 0 | 0 | 1 | 0 | 0 | 0 |
| `src/features/orders/services/order-price-list.service.ts` | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| `src/features/orders/pages/OrderDetailPage.vue` | 1 | 3 | 0 | 0 | 1 | 0 | 0 | 0 |
| `src/features/orders/pages/OrderCreatePage.vue` | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 1 |
| `src/features/orders/composables/use-corner-editor.ts` | 1 | 2 | 0 | 0 | 0 | 0 | 1 | 0 |
| `src/features/orders/composables/use-document-detect.ts` | 5 | 20 | 4 | 0 | 0 | 1 | 0 | 0 |
| `src/features/orders/composables/use-order-overlay-route.ts` | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| `src/features/orders/order-status-presentation.ts` | 1 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| `src/features/orders/components/DocumentScannerOverlay.vue` | 19 | 50 | 7 | 1 | 2 | 7 | 0 | 2 |
| `src/features/customers/utils/waiting-pickup.filter.ts` | 1 | 5 | 0 | 0 | 1 | 0 | 0 | 0 |
| `src/features/customers/stores/customer.store.ts` | 4 | 5 | 1 | 1 | 1 | 1 | 0 | 0 |
| `src/features/customers/services/waiting-pickup.service.ts` | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| `src/features/customers/services/customer.service.ts` | 4 | 5 | 2 | 2 | 0 | 0 | 0 | 0 |
| `src/features/customers/pages/CustomerListPage.vue` | 2 | 3 | 0 | 0 | 0 | 2 | 0 | 0 |
| `src/features/customers/pages/CustomerDetailPage.vue` | 1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| `src/features/customers/composables/useOrderSheetRoute.ts` | 2 | 4 | 0 | 2 | 0 | 0 | 0 | 0 |
| `src/features/customers/composables/useCustomerFilterRoute.ts` | 2 | 2 | 1 | 0 | 1 | 0 | 0 | 0 |
| `src/features/customers/components/CustomerTypeTabs.vue` | 1 | 5 | 0 | 1 | 0 | 0 | 0 | 0 |
| `src/features/customers/components/CustomerCard.vue` | 1 | 3 | 0 | 0 | 0 | 0 | 1 | 0 |
| `src/features/customer-packages/stores/customer-package-purchase.store.ts` | 3 | 7 | 0 | 0 | 1 | 1 | 1 | 0 |
| `src/features/customer-packages/services/customer-package.service.ts` | 4 | 15 | 2 | 1 | 1 | 0 | 0 | 0 |
| `src/features/customer-packages/components/CustomerPackageExtraFilter.vue` | 2 | 4 | 0 | 0 | 0 | 1 | 1 | 0 |
| `src/features/customer-packages/preview/variant-c/VariantC.vue` | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| `src/features/customer-packages/pages/CustomerPackageCreatePage.vue` | 1 | 2 | 0 | 0 | 0 | 1 | 0 | 0 |
| `src/features/customer-packages/pages/CustomerPackageDetailPage.vue` | 1 | 3 | 0 | 0 | 0 | 1 | 0 | 0 |
| `src/features/customer-packages/composables/useCustomerPackageTransactionRoute.ts` | 2 | 3 | 0 | 2 | 0 | 0 | 0 | 0 |
| `src/features/packages/services/package.service.ts` | 2 | 2 | 0 | 0 | 0 | 0 | 2 | 0 |
| `src/features/price-list/pages/PriceListPage.vue` | 2 | 5 | 2 | 0 | 0 | 0 | 0 | 0 |
| `src/features/price-list/pages/PriceListFormPage.vue` | 1 | 4 | 1 | 0 | 0 | 0 | 0 | 0 |
| `src/features/price-list/components/PriceListServicePanel.vue` | 1 | 3 | 0 | 0 | 0 | 1 | 0 | 0 |
| `src/features/price-list/components/PriceListServiceFilter.vue` | 2 | 4 | 0 | 0 | 0 | 1 | 1 | 0 |
| `src/features/price-list/components/PriceListCard.vue` | 1 | 2 | 1 | 0 | 0 | 0 | 0 | 0 |

There were 26 additional zero-comment files under `src/features/orders/`; they contributed 0 blocks and 0 lines. No explorer reported a disagreement because all scopes were disjoint.

## Documentation work by destination

### `docs/conventions/contracts/api.md`

`## Rules` — from `src/features/invoices/services/invoice.service.ts:33-53`:

> `POST /api/invoices` returns the `CreateInvoiceResponse` discriminated union directly, rather than the standard `{ success, data, meta }` envelope. The client reads and validates the body even for non-OK statuses and maps an unrecognized body to an `items_write_failed` outcome with `certainty: 'unknown'`.

`## Boundary` — from `src/features/invoices/services/invoice-detail.service.ts:23`:

> `getInvoiceDetail` returns `null` when the requested invoice is not found. Other lookup failures remain errors.

`## Rules` — from `src/features/customer-packages/stores/customer-package-purchase.store.ts:45-48`:

> CYCLE invoices must carry both `billingPeriodStart` and `billingPeriodEnd`; customer-package purchases derive them from the package’s `startDate` and `expiryDate`. Reject the purchase before invoice creation when either date is absent.

### `docs/architecture/backend/operations.md`

`## Sheets writes and certainty` — from `src/features/invoices/services/invoice.service.ts:74`:

> `ORDER` invoice creation writes the invoice number into the source `OrderForm.invoice_id` after the invoice items and header are recorded. `CYCLE` invoices have no source order and skip this linkage stage.

### `docs/architecture/backend/persistence.md`

`## Reads` — from `src/features/customer-packages/services/customer-package.service.ts:51-56`:

> GViz may return numeric-looking identifier cells as numbers. Normalizing them to strings restores the DTO type but cannot restore a lost leading zero; columns requiring that digit must be stored as Plain Text.

### `docs/conventions/data-fetching.md`

`## Bounded queries` — from `src/features/customers/utils/waiting-pickup.filter.ts:10-14`:

> The appointments list API exposes an exact `appointmentDate` filter but no `deletedAt` or date-range filter. Waiting-pickup filtering therefore remains client-side; soft-deleted rows may appear, so this helper is not a deletion-correctness boundary.

`## Cache policy` — from `src/features/customers/stores/customer.store.ts:14`:

> `useCustomerStore` caches the full customer list and skips subsequent loads unless `force` is true. Set `force: true` or call `invalidate()` when the next load must refetch.

### `docs/design/patterns/list-pages.md`

`## Filters` — from `src/features/invoices/composables/useInvoiceFilterRoute.ts:38-42`:

> Durable invoice filters are derived from the route query and written with router.replace. Serializing the default filter omits default-valued entries so the default state has a clean empty query.

`## Filters` — from `src/features/customers/composables/useCustomerFilterRoute.ts:7`:

> Customer list filters are route-owned query state: derive them from `route.query` and update them with `router.replace`. Omit default values when serializing the query.

### `docs/features/orders/order-detail-screen.md`

`## Caching` — from `src/features/orders/stores/order.store.ts:49-53`:

> When the list already contains an order, the detail store seeds the header from that row while the detail request is in flight. It preserves an existing detail object for the same order so a refresh does not replace loaded items with an empty seed.

### `docs/features/orders/order-item-form.md`

`## Fields` — from `src/features/orders/services/order-price-list.service.ts:15`:

> The price-list picker requests up to 1,000 catalogue rows. When the result reaches that limit, the picker marks the catalogue as truncated and tells staff that search covers only the loaded rows.

`## Overlay` — from `src/features/orders/composables/use-order-overlay-route.ts:28`:

> The canonical overlay query is `orderAction=item`, but the reader continues to accept `?item=new` for existing deep links. New links should write only the canonical key.

### `docs/features/orders/forms/create-order-image.md`

`## Overlay behaviour` — from `src/features/orders/pages/OrderDetailPage.vue:68-70`:

> On the order detail page, DOCUMENT uses `DocumentScannerOverlay`; WEIGHT and BELONGING use the shared `CameraOverlay`. The page passes `open=false` to the inactive overlay so only one camera stream can run at a time.

`## Scanner state machine` — from `src/features/orders/components/DocumentScannerOverlay.vue:44-47`:

> The document scanner moves from `viewfinder` to `capturing` to `adjusting` to `warping`, then returns to `viewfinder` after success. Capture failures return to `viewfinder`; warp failures return to `adjusting` with the captured still preserved.

`## Document detection` — from `src/features/orders/components/DocumentScannerOverlay.vue:255-256`:

> The live document outline is drawn only when detection produces a usable quadrilateral. A miss clears the outline so the UI does not imply that detection succeeded.

## MOVE — NO OWNER

None. Every MOVE finding has a reasonable existing destination document.
