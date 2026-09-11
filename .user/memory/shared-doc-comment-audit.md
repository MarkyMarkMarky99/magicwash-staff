# Audit — doc-comments in src/shared/ vs docs/

Produced 2026-09-12 by a codex explore run, nine explorers, one per file group.
Source of record for cleanup item 3. Read-only audit: no code was changed.

Claude's verification notes are marked > VERIFIED / > CORRECTION inline.

---

## Claude's verification, 2026-09-12

Spot-checked against the real code and the real documents, not taken on trust.

**STALE findings — checked 2 of 4, both correct.**

- `persistent-cache.ts:55-56` CONFIRMED. The guard at `:77-83` tests object-ness and
  `typeof parsed.t !== 'number'` only. `parsed.v` is never validated, so any shape survives.
- `response-cache.ts:132-133` CONFIRMED. `store()` rejects `bytes > CACHE_MAX_BYTES` before
  inserting (`:119-122`), and `evictDownTo` (`:55-63`) evicts ascending by `lastUsed` while
  returning as soon as the budget is met. The new entry carries the highest `lastUsed`, so it is
  evicted last and only if it alone exceeds the budget — the case already rejected. The comment
  describes something that cannot happen.

**ALREADY-DOCUMENTED — checked 1, correct.** `api-client.ts:44-48` maps to a dedicated
`## onFresh is required` section in `docs/conventions/data-fetching.md`.

**Two problems with this audit that the numbers hide:**

1. **30 of the 86 verdicts rest on two documents, and one of them is a plan.** 21 cite
   `docs/plans/cache-gateway.md` and 19 cite `docs/conventions/data-fetching.md` (they overlap).
   `cache-gateway.md` is explicitly build history — its own first line now points at
   `data-fetching.md` for live rules — so "already documented in a plan" is not the same as
   documented. Those need re-pointing at the convention before the comment is deleted, or the
   knowledge lands in a file nobody treats as authoritative.
   `data-fetching.md` and `app-boot.md` were drafted by an earlier session, merged in `ccf187a`,
   and the user has never read them. Deleting 30 comments on their authority means trusting
   unreviewed documents.

2. **The totals row disagrees with the table it summarises.** The row claims DELETE 16 / MOVE 8 /
   STALE 4; counting the rows gives DELETE 17 / MOVE 1 / STALE 5, with the eight MOVE items
   (M1-M8) appearing only in the documentation-edits section. Treat the per-row verdicts as real
   and the totals as indicative.

**One audit row is wrong.** `ListContainer.vue:11-13` is listed DELETE as "narrates the nullable prop type already expressed by the declaration". It does not. It records why the `PropType` cast exists: without it Vue infers `string | undefined` and every call site that passes a nullable store error becomes a type error. That is a constraint the code cannot state, so it is a KEEP. Executed as 19 deletions, not 20. Treat every DELETE row as a claim to check, not an instruction.

**KEEP is too generous.** 23 KEEP out of 86 against a brief that said a long block is almost never
a KEEP. Each proposed reduced `//` line needs a second pass before any of them is written.

---

Read-only review complete. No files were modified, created, staged, or committed.

The actual inventory is 86 comment blocks across 18 files, totaling 289 comment lines. The background estimate was approximate.

## STALE findings

These should be deleted, not moved into documentation:

| Location | Defect | Evidence |
|---|---|---|
| `src/shared/api/persistent-cache.ts:55-56` | Claims the parse guard catches shape mismatches, but it only checks object-ness and numeric `t`; `v` is not validated. | Guard: `src/shared/api/persistent-cache.ts:77-83` |
| `src/shared/api/persistent-cache.ts:188-189` | Claims the next read revalidates even when persisted clearing fails. Persisted data can remain and be promoted back into memory. | Clear failure: `src/shared/api/persistent-cache.ts:175-189`; promotion: `src/shared/api/response-cache.ts:78-99,144-157` |
| `src/shared/api/response-cache.ts:132-133` | Claims the newly written entry may be evicted. Oversized entries are rejected before insertion, and normal eviction removes older entries first. | `src/shared/api/response-cache.ts:58-61,119-131`; test: `tests/web/unit/shared/api/response-cache.dry-test.ts:63-66` |
| `src/shared/components/BaseDropdown.vue:21-23` | Says callers mostly clip panels rather than scroll them. The shared implementation now wraps panels in `ScrollRegion`. | `src/shared/components/BaseDropdown.vue:109-120`; `src/shared/components/ScrollRegion.vue:29-34` |

## Consolidated decisions

| Location | Lines | Verdict | Claim | Evidence / reduced form |
|---|---:|---|---|---|
| `src/shared/api/api-client.ts:6-18` | 13 | UNVERIFIED | HTTP boundary, request validation, response pass-through, and dirty backend cells. | Code: `:64,121-125,161-170`; docs: `docs/conventions/data-fetching.md:17-21`, `docs/architecture/backend/operations.md:47-49`. The referenced `api/CLAUDE.md` and full `z.infer` call-site claim were not verifiable from the listed documents. |
| `src/shared/api/api-client.ts:27` | 1 | DELETE | `ApiError` behavior is explicit in the class. | Code: `:28-35` |
| `src/shared/api/api-client.ts:40` | 1 | KEEP | Query input is validated before serialization. | Code: `:64-65,173-184`. Reduced form: `// Query input is validated and serialized before the request.` |
| `src/shared/api/api-client.ts:42` | 1 | ALREADY-DOCUMENTED | Request schemas validate public API inputs. | `docs/conventions/contracts/api.md:44-46`; `docs/conventions/coding.md:24-28` |
| `src/shared/api/api-client.ts:44-48` | 5 | ALREADY-DOCUMENTED | `onFresh` receives background-refresh results. | `docs/conventions/data-fetching.md:49-53` |
| `src/shared/api/api-client.ts:52` | 1 | DELETE | Merely aliases `GetListOptions.onFresh`. | Code: `:44-53` |
| `src/shared/api/api-client.ts:56-59` | 4 | KEEP | List items pass through without runtime response parsing. | Code: `:67-72,123-125`. Reduced form: `// List response items pass through without runtime parsing.` |
| `src/shared/api/api-client.ts:75` | 1 | DELETE | Function name and return expression show envelope unwrapping. | Code: `:76-77` |
| `src/shared/api/api-client.ts:81-87` | 7 | ALREADY-DOCUMENTED | Cache hits, stale-while-revalidate, callback refresh, and request sharing. | `docs/conventions/data-fetching.md:35-36,49-53`; `docs/plans/cache-gateway.md:29-30,104-105` |
| `src/shared/api/api-client.ts:99-100` | 2 | KEEP | Background refresh failures are swallowed. | Code: `:98-106`. Reduced form: `// Background revalidation is best-effort and never replaces the cached value on failure.` |
| `src/shared/api/api-client.ts:109` | 1 | ALREADY-DOCUMENTED | Same-URL requests share one in-flight promise. | `docs/conventions/data-fetching.md:19-21`; `docs/plans/cache-gateway.md:104-105` |
| `src/shared/api/api-client.ts:134` | 1 | ALREADY-DOCUMENTED | Write bodies use shared API contracts. | `docs/conventions/coding.md:24-28`; `docs/conventions/contracts/api.md:44-46` |
| `src/shared/api/api-client.ts:136` | 1 | DELETE | Property name and type identify the schema role. | Code: `:133-138` |
| `src/shared/api/api-client.ts:140` | 1 | DELETE | Function name and return call show POST unwrapping. | Code: `:141-145` |
| `src/shared/api/api-client.ts:148` | 1 | DELETE | Function name and return call show PATCH unwrapping. | Code: `:149-153` |
| `src/shared/api/api-client.ts:173` | 1 | KEEP | Query serialization omits nullish and empty-string values. | Code: `:175-184`. Reduced form: `// Serialize query parameters, omitting nullish and empty-string values.` |
| `src/shared/api/api-client.ts:187` | 1 | KEEP | Valid error envelopes become `ApiError`; invalid ones degrade generically. | Code: `:188-197`. Reduced form: `// Build ApiError from a valid error envelope, otherwise use a generic message.` |
| `src/shared/api/api-client.ts:195` | 1 | KEEP | Invalid/non-JSON error bodies use the status message. | Code: `:189-197`. Reduced form: `// Non-JSON or invalid error bodies fall back to the generic status message.` |
| `src/shared/api/persistent-cache.ts:3-7` | 5 | ALREADY-DOCUMENTED | Storage-version changes purge incompatible entries. | `docs/conventions/data-fetching.md:40-47`; `docs/plans/cache-gateway.md:136-146` |
| `src/shared/api/persistent-cache.ts:14` | 1 | DELETE | Narrates an obvious field type and role. | Code: `:13-15` |
| `src/shared/api/persistent-cache.ts:16` | 1 | ALREADY-DOCUMENTED | Persisted timestamps preserve response freshness. | `docs/conventions/data-fetching.md:44-47`; `docs/plans/cache-gateway.md:106-108` |
| `src/shared/api/persistent-cache.ts:20-23` | 4 | KEEP | `localStorage` may be absent or throw on access. | Code: `:24-29`. Reduced form: `// Safely access localStorage when it is unavailable or throws on access.` |
| `src/shared/api/persistent-cache.ts:41-45` | 5 | ALREADY-DOCUMENTED | Import-time purge removes other storage versions. | `docs/architecture/frontend/app-boot.md:50-54`; `docs/plans/cache-gateway.md:144-146` |
| `src/shared/api/persistent-cache.ts:55-56` | 2 | STALE | Incorrect parse-guard claim. | See STALE findings above. |
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
| `src/shared/api/persistent-cache.ts:188-189` | 2 | STALE | Incorrect claim that the next read necessarily revalidates. | See STALE findings above. |
| `src/shared/api/persistent-cache.ts:193` | 1 | DELETE | Function name and return shape explain the stats accessor. | Code: `:193-204` |
| `src/shared/config/cache.ts:1-7` | 7 | ALREADY-DOCUMENTED | Read-only cache and explicit invalidation policy. | `docs/plans/cache-gateway.md:21-36`; `docs/conventions/data-fetching.md:17-21,56-59` |
| `src/shared/config/cache.ts:9-14` | 6 | ALREADY-DOCUMENTED | Zero-hour entries serve cached data before revalidation. | `docs/conventions/data-fetching.md:25-38`; `docs/plans/cache-gateway.md:32-36` |
| `src/shared/config/cache.ts:17-30` | 14 | UNVERIFIED | Endpoint-prefix policy and one-hour rationale are documented, but “raise it after real-world use” is not. | `docs/plans/cache-gateway.md:112-116` supports one hour; no listed document verifies `:29`. The same plan has an inconsistent undecided note at `:131-134`. |
| `src/shared/config/cache.ts:36-43` | 8 | ALREADY-DOCUMENTED | Only customers and price-list endpoints persist. | `docs/conventions/data-fetching.md:27-38`; `docs/plans/cache-gateway.md:95-97` |
| `src/shared/config/cache.ts:46` | 1 | ALREADY-DOCUMENTED | `NEVER_CACHE` bypasses caching. | `docs/conventions/data-fetching.md:29-36`; `docs/plans/cache-gateway.md:85-86` |
| `src/shared/config/cache.ts:49` | 1 | ALREADY-DOCUMENTED | In-memory cache has a 4 MiB LRU ceiling. | `docs/conventions/data-fetching.md:40-46`; `docs/plans/cache-gateway.md:88-89` |
| `src/shared/config/cache.ts:52-59` | 8 | UNVERIFIED | Persisted quota rationale, including issue-report storage, is not fully documented. | `docs/plans/cache-gateway.md:44-52,140-143`; no listed document verifies the issue-report reporter claim. |
| `src/shared/config/cache.ts:63-64` | 2 | DELETE | Restates `cacheable: boolean`. | Code: `:64` |
| `src/shared/config/cache.ts:65-66` | 2 | ALREADY-DOCUMENTED | Freshness hours and zero-hour behavior. | `docs/conventions/data-fetching.md:29-38` |
| `src/shared/config/cache.ts:67-68` | 2 | ALREADY-DOCUMENTED | Persistence across reloads. | `docs/conventions/data-fetching.md:35-38`; `docs/plans/cache-gateway.md:35-36` |
| `src/shared/config/cache.ts:75` | 1 | DELETE | Function name and implementation explain policy lookup. | Code: `:75-86` |
| `src/shared/api/response-cache.ts:4-18` | 15 | ALREADY-DOCUMENTED | Cache layers, URL keys, LRU, persistence, and promotion. | `docs/conventions/data-fetching.md:25-47`; `docs/plans/cache-gateway.md:29-36,101-108` |
| `src/shared/api/response-cache.ts:24-28` | 5 | KEEP | Monotonic counter makes LRU deterministic within one millisecond. | Code: `:58-62,81`. Reduced form: `// Monotonic counter keeps LRU order deterministic within the same millisecond.` |
| `src/shared/api/response-cache.ts:38` | 1 | DELETE | Restates `measure()` and its comparison. | Code: `:39-45` |
| `src/shared/api/response-cache.ts:54` | 1 | DELETE | Restates eviction function behavior. | Code: `:55-63` |
| `src/shared/api/response-cache.ts:67` | 1 | ALREADY-DOCUMENTED | Freshness flag semantics. | `docs/conventions/data-fetching.md:35-37,49-53` |
| `src/shared/api/response-cache.ts:71-76` | 6 | ALREADY-DOCUMENTED | Stale values return while refresh runs in background. | `docs/plans/cache-gateway.md:29-31` |
| `src/shared/api/response-cache.ts:88-91` | 4 | ALREADY-DOCUMENTED | Storage promotion preserves original timestamp. | `docs/plans/cache-gateway.md:106-108` |
| `src/shared/api/response-cache.ts:102` | 1 | DELETE | Restates `writeCache()` and eviction. | Code: `:103-107` |
| `src/shared/api/response-cache.ts:110-117` | 8 | KEEP | Promotion preserves age and avoids immediate writeback. | Code: `:99,107,113-116`. Reduced form: `// Preserve response age and avoid rewriting entries promoted from storage.` |
| `src/shared/api/response-cache.ts:120-122` | 3 | KEEP | Oversized responses are skipped rather than evicting everything. | Code: `:119-127`; test: `tests/web/unit/shared/api/response-cache.dry-test.ts:63-66`. Reduced form: `// Skip a response larger than the full budget instead of evicting existing entries.` |
| `src/shared/api/response-cache.ts:132-133` | 2 | STALE | Incorrect eviction claim. | See STALE findings above. |
| `src/shared/api/response-cache.ts:137-143` | 7 | ALREADY-DOCUMENTED | Explicit, full, and endpoint-prefix invalidation. | `docs/conventions/data-fetching.md:56-59`; `docs/plans/cache-gateway.md:25-30,92-93` |
| `src/shared/api/response-cache.ts:160` | 1 | DELETE | Stats accessor purpose is explicit. | Code: `:161-163` |
| `src/shared/components/BaseSwipeCard.vue:56` | 1 | DELETE | Restates the following conditional/action. | Code: `:57` |
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
| `src/shared/components/ListContainer.vue:11-13` | 3 | DELETE | Narrates the nullable prop type already expressed by the declaration. | Code: `:14` |
| `src/shared/components/ListContainer.vue:14` | 1 | KEEP | Inline JSDoc cast is required for strict nullable Vue typing. | Code: `:14`; strict checking: `tsconfig.web.json:6-10`. Reduced form for the surrounding rationale: `// Keep the nullable PropType<string | null> cast for strict Vue typing.` |
| `src/shared/components/ListContainer.vue:20-22` | 3 | MOVE M6 | Search is opt-in because reusable screens can contain multiple list sections. | Code: `:23`; usages in appointment and customer-detail pages; destination: `docs/design/patterns/list-pages.md`, “Filters” |
| `src/shared/components/ListContainer.vue:44-45` | 2 | KEEP | URL filters reveal the search field. | Code: `:36-46`. Reduced form: `// Reveal search when a non-empty URL filter arrives.` |
| `src/shared/utils/service-type-labels.ts:3-14` | 12 | MOVE M7 | Shared presentation map prevents feature-local service-type copies. | Map: `:18-23`; destination: `docs/features/orders/data-model.md`, “service_type — canonical values” |
| `src/shared/utils/service-type-labels.ts:25` | 1 | KEEP | Unknown service types remain raw on reads. | Code: `:26-29`. Reduced form: `// Preserve unknown service-type values on reads; known codes use the shared presentation map.` |
| `src/shared/config/actor.ts:1` | 1 | ALREADY-DOCUMENTED | Writes use `admin` until authentication exists. | `docs/features/orders/order-create-screen.md:21-26`; `order-item-form.md:19-21` |
| `src/shared/config/actor.ts:4-10` | 7 | UNVERIFIED | Query override and fallback work, but AppSheet provenance is not documented or independently verified. | Code: `:11-13`; caller: `src/features/gallery/pages/OrderGalleryPage.vue:35-37` |
| `src/shared/components/BaseDropdown.vue:21-23` | 3 | STALE | Outdated clipping behavior claim. | See STALE findings above. |
| `src/shared/components/BaseDropdown.vue:32-34` | 3 | KEEP | Vue template refs may provide component instances. | Code: `:3,35-37`; usage: `src/features/orders/components/OrderItemsMenu.vue:18-21`. Reduced form: `// Accept Vue's component-instance ref shape so template refs type-check at every call site.` |
| `src/shared/api/firebase-storage.ts:8-14` | 7 | ALREADY-DOCUMENTED | Shared upload helper serves both photo systems; only folder differs. | `docs/plans/image-pipeline.md:5-18`; `docs/features/orders/forms/create-order-image.md:49-54,59-66` |
| `src/shared/stores/selected-customer.store.ts:6-17` | 12 | MOVE M8 | Cross-feature handoff and location fallback rules. | Code: `:20-42`; consumer: `src/features/appointments/pages/CreateAppointmentPage.vue:6,14`; destination: `docs/features/orders/overview.md`, “SHARED GAPS” |
| `src/shared/layouts/ListPageLayout.vue:5-7` | 3 | KEEP | Search belongs to `ListContainer`; layout owns filters and scroll region. | Code: `:20-26`; pattern: `docs/design/patterns/list-pages.md:18-29`. Reduced form: `// Search belongs to ListContainer; this layout owns filters and the page scroll region.` |
| `src/shared/components/FormPicker.vue:353-354` | 2 | KEEP | Long address and phone values must wrap. | CSS: `:350-356`. Reduced form: `// Long address and phone values must wrap within the option track.` |
| `src/shared/components/FormInput.vue:75-80` | 6 | KEEP | Native date control sizing is overridden to fit two-column fields. | CSS: `:81-90`; usage: `src/features/orders/pages/OrderCreatePage.vue:76`. Reduced form: `// Remove native date-control sizing so two date fields fit while the 47px control keeps a 45px content line.` |

## Per-file totals

| File | Blocks | Comment lines | DELETE | ALREADY-DOCUMENTED | MOVE | KEEP | STALE | UNVERIFIED |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `src/shared/api/api-client.ts` | 18 | 44 | 6 | 5 | 0 | 6 | 0 | 1 |
| `src/shared/api/persistent-cache.ts` | 18 | 51 | 2 | 8 | 1 | 5 | 2 | 0 |
| `src/shared/config/cache.ts` | 11 | 49 | 2 | 7 | 0 | 0 | 0 | 2 |
| `src/shared/api/response-cache.ts` | 13 | 55 | 4 | 5 | 0 | 3 | 1 | 0 |
| `src/shared/components/BaseSwipeCard.vue` | 2 | 11 | 1 | 0 | 0 | 0 | 0 | 1 |
| `src/shared/utils/sheet-date.ts` | 8 | 12 | 0 | 2 | 4 | 2 | 0 | 0 |
| `src/shared/components/NavSidebar.vue` | 1 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| `src/shared/components/ListContainer.vue` | 4 | 9 | 1 | 0 | 1 | 2 | 0 | 0 |
| `src/shared/utils/service-type-labels.ts` | 2 | 13 | 0 | 0 | 1 | 1 | 0 | 0 |
| `src/shared/config/actor.ts` | 2 | 8 | 0 | 1 | 0 | 0 | 0 | 1 |
| `src/shared/components/BaseDropdown.vue` | 2 | 6 | 0 | 0 | 0 | 1 | 1 | 0 |
| `src/shared/components/AppHeader.vue` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `src/shared/api/firebase-storage.ts` | 1 | 7 | 0 | 1 | 0 | 0 | 0 | 0 |
| `src/shared/stores/selected-customer.store.ts` | 1 | 12 | 0 | 0 | 1 | 0 | 0 | 0 |
| `src/shared/stores/delivery-booking-intent.store.ts` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `src/shared/layouts/ListPageLayout.vue` | 1 | 3 | 0 | 0 | 0 | 1 | 0 | 0 |
| `src/shared/components/FormPicker.vue` | 1 | 2 | 0 | 0 | 0 | 1 | 0 | 0 |
| `src/shared/components/FormInput.vue` | 1 | 6 | 0 | 0 | 0 | 1 | 0 | 0 |
| **Total** | **86** | **289** | **16** | **30** | **8** | **23** | **4** | **5** |

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

No explorer failed to spawn, and no material disagreement between explorer verdicts was reported.
