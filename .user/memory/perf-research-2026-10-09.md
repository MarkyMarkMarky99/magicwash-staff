# Data-fetch performance research (Codex read-only, 2026-10-09)

Costs are estimates from measured scan times; not yet re-measured. Spot-checked #1, #3, #4 against code.

The first three fixes offer the clearest benefit: **stop refreshing LaundryPhotos after each garment capture, batch Packaging Confirm reads, and reduce order-invalidation fan-out.**

I worked alone and read only. No files or Sheets were changed. I made no new live measurements: costs below are estimates based on your supplied measurements and confirmed request structure. Production latency, payload sizes beyond your supplied figures, and staff usage counts remain unmeasured. Parallel scans are counted as workload, not added together as elapsed time.

1. **Garment registration rereads LaundryPhotos after every saved photo.**

   **Evidence:** Each successful capture calls `refreshLaundryPhotos` in [OrderDetailPage.vue:411](C:/MagicwashGemini/webapp-vue/src/features/orders/pages/OrderDetailPage.vue:411). Creating a photo first invalidates the entire endpoint cache in [laundry-photo.service.ts:95](C:/MagicwashGemini/webapp-vue/src/data/laundry-photos/laundry-photo.service.ts:95), so the one-hour freshness policy cannot absorb these refreshes.

   **Cost and frequency:** One additional scan of the 68,769-row sheet after every successful garment capture, unless concurrent refreshes share an in-flight request. Using the supplied 2.0-second scan as a rough proxy, 50 separated captures generate about **100 seconds of cumulative scan work**, plus repeated transfer of the order’s photo rows. This runs in the background rather than blocking the camera, but repeatedly reloads growing data for counts.

   **Fix direction:** Update the current order’s photos/counts from the successful create result and submitted fields, then reconcile once after the capture session. Keep invalidation for other consumers, but stop immediately refetching the list after each append.

2. **Packaging Confirm multiplies reads by bag count and repeats ticket reads through completion.**

   **Evidence:** [packaging-bag.service.ts:53](C:/MagicwashGemini/webapp-vue/server/modules/packaging-bags/packaging-bag.service.ts:53) reads OrderImages separately for every bag. Its sequential provisioning loop at [line 98](C:/MagicwashGemini/webapp-vue/server/modules/packaging-bags/packaging-bag.service.ts:98) calls a service that reads JobTickets, then OrderForm for each new bag ([bag-logistics-ticket.service.ts:22](C:/MagicwashGemini/webapp-vue/server/modules/order-images/bag-logistics-ticket.service.ts:22)). Completion rereads tickets and can invoke two more read/write transitions ([job-ticket-advance.service.ts:137](C:/MagicwashGemini/webapp-vue/server/modules/job-tickets/job-ticket-advance.service.ts:137)). Printing also performs customer resolution separately for each bag ([bag-tag-print.service.ts:51](C:/MagicwashGemini/webapp-vue/server/modules/bag-tag-prints/bag-tag-print.service.ts:51)).

   **Cost and frequency:** Every confirmation, increasing with bags and completion chunks. For three new bags, provisioning alone has six sequential scans: roughly **3 × (0.45 + 0.8) = 3.75 seconds**, before writes. Pending garments can add three ticket-read stages per completion chunk. Enabled printing adds another OrderForm lookup per bag, plus customer reads and printer time.

   **Fix direction:** Batch image-ID validation, load the order header once, and provision all missing logistics tickets together. Carry request-local validated context through completion and printing, retaining ownership checks, retry handling, and write verification.

3. **Order invalidation eagerly reloads unrelated or hidden screens.**

   **Evidence:** Item writes invalidate all `/api/work-orders` responses ([order-item.service.ts:13](C:/MagicwashGemini/webapp-vue/src/data/order-items/order-item.service.ts:13)). Listeners immediately reload the full snapshot ([order-snapshot.store.ts:42](C:/MagicwashGemini/webapp-vue/src/data/order-snapshots/order-snapshot.store.ts:42)), retained detail/list ([work-order.store.ts:124](C:/MagicwashGemini/webapp-vue/src/data/work-orders/work-order.store.ts:124)), and previously loaded customer history ([order.store.ts:60](C:/MagicwashGemini/webapp-vue/src/data/orders/order.store.ts:60)). Those stores retain their subjects; most pages are kept alive ([App.vue:187](C:/MagicwashGemini/webapp-vue/src/App.vue:187)).

   **Cost and frequency:** After item additions, quantity changes, and order writes, depending on previously visited screens. With snapshot, detail, and customer history initialized, one invalidation can cause **three OrderForm scans plus one OrderItemForms scan**—roughly 3.5 seconds of cumulative scan work using your proxies. A retained work-order list can add another scan. These distinct URLs cannot share one client request.

   **Fix direction:** Scope invalidation to affected orders/customers and mark hidden consumers dirty for their next activation. Reconcile known write results locally and schedule one refresh for the visible consumer.

4. **Department batch advancement fans out one JobTickets scan per distinct order.**

   **Evidence:** `/api/job-tickets/advance` maps every distinct order to a separate repository read ([job-ticket-advance.service.ts:62](C:/MagicwashGemini/webapp-vue/server/modules/job-tickets/job-ticket-advance.service.ts:62)). The department screen submits batches of up to 200 ticket entries ([DepartmentWorkPage.vue:273](C:/MagicwashGemini/webapp-vue/src/features/job-tickets/pages/DepartmentWorkPage.vue:273)).

   **Cost and frequency:** Every batch Start/Complete confirmation spanning multiple orders. Twenty distinct orders mean twenty scans—approximately **9 seconds of cumulative scan work** at the measured 0.45 seconds per order. They run concurrently, so elapsed time is not necessarily nine seconds, but contention and tail latency are unmeasured. Your all-open read costing about 0.6 seconds shows the poor tradeoff.

   **Fix direction:** Fetch tickets for all requested order IDs in one query and group them in memory. Include completed predecessor tickets required for gating; fetching only open tickets would change validation behavior.

5. **Order List and Report reload the entire order snapshot on every activation.**

   **Evidence:** Both pages call `load()` when activated ([OrderListPage.vue:43](C:/MagicwashGemini/webapp-vue/src/features/orders/pages/OrderListPage.vue:43), [OrderReportPage.vue:92](C:/MagicwashGemini/webapp-vue/src/features/order-reports/pages/OrderReportPage.vue:92)). The store shares only an ongoing request; after completion, another `load()` starts another read ([order-snapshot.store.ts:13](C:/MagicwashGemini/webapp-vue/src/data/order-snapshots/order-snapshot.store.ts:13)). The endpoint returns all orders, although it already selects a sensible column subset ([order-snapshot.service.ts:18](C:/MagicwashGemini/webapp-vue/server/modules/order-snapshots/order-snapshot.service.ts:18)).

   **Cost and frequency:** Every return to the order list or report, including ordinary list → detail → list navigation. Each activation scans all **8,585 OrderForm rows** and transfers the entire snapshot: roughly a 0.8-second scan proxy plus unmeasured serialization/transfer cost. Cold first paint waits; warm navigation can show retained rows while refreshing.

   **Fix direction:** Add a short freshness window with explicit refresh and immediate invalidation after relevant writes. Preserve the existing protection against joining a request that started before a write.

6. **Single-photo reassignment serializes two independent large-sheet reads.**

   **Evidence:** The before-photo PATCH reads LaundryPhotos by photo ID, then OrderItemForms by the destination ID supplied in the request ([laundry-photo.module.ts:124](C:/MagicwashGemini/webapp-vue/server/modules/laundry-photos/laundry-photo.module.ts:124)). The gallery awaits this operation before closing reassignment ([OrderGalleryPage.vue:280](C:/MagicwashGemini/webapp-vue/src/features/gallery/pages/OrderGalleryPage.vue:280)). The after-photo implementation has the same sequence ([after-photo.module.ts:122](C:/MagicwashGemini/webapp-vue/server/modules/after-photos/after-photo.module.ts:122)).

   **Cost and frequency:** Every single-photo move in the gallery. Before-photo validation has approximately **2.0 + 1.1 = 3.1 seconds** of sequential scan cost before the Sheets API update. AfterPhoto latency is unmeasured. The photo-library bulk path already uses a different, batched implementation.

   **Fix direction:** Run the two validation reads concurrently, then perform the existing same-order checks. The before-photo validation stage would approximately fall from 3.1 to 2.0 seconds; retain identity lookup and write verification.

7. **Delivery tracking scans OrderImages twice in a dependent waterfall.**

   **Evidence:** The public QR endpoint first resolves the image ID, then reads all same-order images alongside OrderForm and JobTickets ([delivery-tracking.service.ts:55](C:/MagicwashGemini/webapp-vue/server/modules/delivery-tracking/delivery-tracking.service.ts:55)). Customer lookup follows that entire group at [line 78](C:/MagicwashGemini/webapp-vue/server/modules/delivery-tracking/delivery-tracking.service.ts:78). General repository reads fetch GViz directly without repository caching ([sheet.repository.ts:153](C:/MagicwashGemini/webapp-vue/server/shared/repositories/sheet.repository.ts:153)).

   **Cost and frequency:** Every customer bag-QR opening or refresh; actual traffic is unknown, so this ranks below staff workflows. The estimated first-paint path is **0.7 + max(0.7, 0.8, 0.45) ≈ 1.5 seconds**, then customer lookup and transport. Repeated openings redo the same identity resolution.

   **Fix direction:** Cache stable image-ID → order-ID resolution separately from delivery status, avoiding the first scan on repeat visits. Start customer resolution as soon as OrderForm finishes, and use narrow projections for tracking reads.

Checked and judged minor or already satisfactory:

- **Write headers and append read-backs:** headers are cached with in-flight sharing; normal appends use the API response echo. GViz verification is an exceptional recovery path.
- **Photo-tag paging:** it adds sequential LaundryPhotos scans at 500-row boundaries, but oversized-order prevalence is unknown. Its first page shares the ordinary photo request/cache, so it is not automatically a duplicate read.
- **Photo payload projections and item-picker reads:** there are opportunities to return fewer columns or avoid an extra header read, but column trimming alone does not remove the sheet scan.
- **Customers, invoices, and the two completed JobTickets fixes:** respected the stated decisions and excluded them from findings.
- **Appointments, packages, catalog data, portal, and staff reporting:** checked their read orchestration and caching. Portal already selects columns and shares 60-second reads; other growth concerns lack sufficient size/latency evidence to outrank the findings above.

