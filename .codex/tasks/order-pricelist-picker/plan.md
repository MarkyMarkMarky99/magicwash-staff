# Order pricelist picker — staff workflow

Branch: feat/order-pricelist-picker. User authorized implementation and Terra real user acceptance against localhost:3000, autonomous decisions while asleep.

Checklist:
- [x] Discovery: existing order create/detail/photo, pricelist and relation pickers.
- [x] Placement: frontend architect blueprint.
- [x] UI: frontend designer; build and vue-tsc passed.
- [ ] Data: frontend integrator.
- [ ] Review: Terra frontend reviewer and real browser staff acceptance.

Outcome: create order -> add item opens active DEFAULT pricelist matching order service -> search/category -> select specific priced row -> quantity/notes -> save and see persisted item -> add another or use existing photo menu/camera.

Boundaries: keep itemId null (it refers to separate OrderItems catalogue, not PriceList.id/itemCode). Preserve price as selected snapshot, do not invent totals. Backend retains service ownership. Keep API schemas/backend/shared unchanged. No cross-feature imports. Existing camera/order-image API/Firebase path is supported and must remain working. Never write G:\My Drive\Magicwash\Database\GoogleSheets\*.json.

Existing examples: InvoicePriceListPicker.vue, invoice-price-list store/service/utils; shared FormPicker/BaseOverlay/FormOverlay. Read CLAUDE.md and list shared components before UI work.

Placement: new orders-local OrderPriceListPicker.vue and OrderPriceListItemRow.vue; order-price-list service/store; only small necessary local utilities. OrderDetailPage owns selected DTO and orchestration. orderAction=item stays one route-backed overlay; select changes local step only. Existing OrderItemForm becomes selection confirmation. Clear on order change, close, successful save, reselection; preserve values on failed save. Loading/errors/retry/empty/truncation visible; stale requests must not leak between orders.

Verification: npm run build; meaningful finite focused tests for eligibility/search/stale fetch/form payload where applicable; Terra Playwright Chrome real UI at localhost:3000 including mobile, browser Back, refresh/deep-link, cancel/reopen, search empty/retry, repeated addition, actual create/persist and camera flow. Clearly label test records. Avoid touching existing customer orders. Use synthetic camera media for automated photo test, never capture sleeping user's surroundings. Do not claim real hardware tested. No production deploy/push.

Browser recovery: CUA Transport closed, but installed Playwright works with require('playwright'), chromium.launch({headless:true,channel:'chrome'}), via node shell (require_escalated). Live Sheets-backed requests can take >10 seconds. Port3000 is already running; do not start another server. Actual order detail successfully loaded /api/work-orders/5d977224 and /api/order-images.

