# Invoice contract merge + status-only update + cancel/void UI

## Scope

Fold `contracts/invoices/invoice-view-api.schema.ts` into `contracts/invoices/invoice-api.schema.ts` and delete the view file.
Add a status-only `PATCH /api/invoices/:invoiceNumber` (contract + route + service + `writes.update` flip).
Migrate every import site and add the cancel/void action to `InvoiceDetailPage.vue`.

## Open decision — blocks naming only, not structure

`CANCELLED` vs `VOID` have no defined business difference anywhere (code, DB contract, or the G Drive registry — `Invoice.json` lists both in the enum with no description). Both pass through `invoiceViewResolveStatus_` unchanged, so both survive a view re-sync identically.

| Branch | `invoiceUpdatableStatusSchema` | UI trigger |
|---|---|---|
| A (two statuses) | `z.enum(['CANCELLED', 'VOID'])` | `InvoiceActionsMenu.vue` dropdown, 2 items |
| B (one status) | `z.enum(['CANCELLED'])` | single icon button, no menu component |

Everything else in this plan is identical under both branches. Default if unanswered: **A**.

---

## 1. Merged contract file

`contracts/invoices/invoice-api.schema.ts` — exports in file order. Property order inside `invoiceDetailResponseSchema` is load-bearing (it is the physical InvoicesView column order A..Q): never reorder.

```
invoiceStatusSchema                    # z.enum(DRAFT|UNPAID|OVERDUE|PARTIALLY_PAID|PAID|CANCELLED|VOID)
invoiceBillingTypeSchema               # z.enum(ORDER|CYCLE)
invoiceSortFieldSchema                 # z.enum(issuedDate|dueDate|status|grandTotal)
MAX_INVOICES_PER_PAGE = 100
invoiceListQuerySchema                 # unchanged shape
invoiceAdjustmentCalculationSchema
invoiceAdjustmentInputSchema  -> InvoiceAdjustmentInput
invoiceCustomerSnapshotInputSchema -> InvoiceCustomerSnapshotInput
invoiceLineInputSchema        -> InvoiceLineInput
invoiceCreateSchema           -> CreateInvoiceRequest
invoiceUpdatableStatusSchema           # TODO(open decision): enum members per Branch A or B
invoiceUpdateSchema           -> UpdateInvoiceRequest   # z.object({ status: invoiceUpdatableStatusSchema }).strict() — exactly one key
invoiceCustomerSchema                  # was invoiceViewCustomerSchema
invoiceAdjustmentSchema                # was invoiceViewAdjustmentSchema
invoiceItemSchema                      # was invoiceViewItemSchema
invoicePaymentSchema                   # was invoiceViewPaymentSchema
invoiceDetailResponseSchema            # was invoicePortalRowSchema; defined directly, no intermediate alias
invoiceListResponseSchema              # invoiceDetailResponseSchema.pick({ ...same 15 keys as today }) — omits items, payments
createInvoiceSuccessSchema
createInvoiceValidationErrorSchema
invoiceWriteFailureCertaintySchema
createInvoiceItemsFailedSchema
createInvoiceHeaderFailedSchema
createInvoiceOrderLinkFailedSchema
createInvoiceViewSyncFailedSchema
createInvoiceResponseSchema   -> CreateInvoiceResponse + the 6 per-kind aliases   # discriminated union, NOT a bundle slot
invoiceUpdateResponseSchema   -> UpdateInvoiceResponse
invoiceNumberCheckResultSchema -> InvoiceNumberCheckResult
invoiceApiContract
```

```
invoiceUpdateResponseSchema = z.object({
  invoiceNumber: z.string(),
  status: invoiceUpdatableStatusSchema,
  viewSynced: z.boolean(),                # false = source row written, InvoicesView still stale
})
```

```
invoiceApiContract satisfies ModuleApiContract
 L query.list      = invoiceListQuerySchema
 L request.create  = invoiceCreateSchema
 L request.update  = invoiceUpdateSchema
 L response.list   = invoiceListResponseSchema
 L response.detail = invoiceDetailResponseSchema
 L response.create = createInvoiceSuccessSchema    # NOT createInvoiceResponseSchema: ResponseSchema requires `.shape`, a discriminatedUnion has none
 L response.update = invoiceUpdateResponseSchema
```

Delete `contracts/invoices/invoice-view-api.schema.ts`. Keep `z.infer` aliases exactly as listed above and add no others.

### Rename table

| Old symbol | New symbol | Call sites to change |
|---|---|---|
| `invoiceViewStatusSchema` | `invoiceStatusSchema` | `src/features/invoices/types/invoices.types.ts` |
| `invoiceViewBillingTypeSchema` | `invoiceBillingTypeSchema` | contract file only |
| `invoiceViewSortFieldSchema` | `invoiceSortFieldSchema` | contract file only |
| `invoiceViewCustomerSchema` | `invoiceCustomerSchema` | contract file only |
| `invoiceViewAdjustmentSchema` | `invoiceAdjustmentSchema` | contract file only |
| `invoiceViewItemSchema` | `invoiceItemSchema` | contract file only |
| `invoiceViewPaymentSchema` | `invoicePaymentSchema` | contract file only |
| `invoicePortalRowSchema` | `invoiceDetailResponseSchema` | comment at `tests/server/unit/modules/invoices/invoice-read.dry-test.ts:44` |
| `invoiceViewApiContract` | `invoiceApiContract` | `server/modules/invoices/invoice.service.ts` |
| `invoiceListQuerySchema` | unchanged | path-only change |
| `invoiceListResponseSchema` | unchanged | path-only change |
| `invoiceDetailResponseSchema` | unchanged | path-only change |
| `MAX_INVOICES_PER_PAGE` | unchanged | contract file only |

Server-local type aliases in `invoice.service.ts:228-231` keep their names (`InvoiceViewApiRow`, `InvoiceViewListQuery`, `InvoiceViewListResponse`, `InvoiceViewDetailResponse`) but retarget:

```
InvoiceViewListQuery      = z.infer<typeof invoiceReadContract.query.list>
InvoiceViewListResponse   = z.infer<typeof invoiceReadContract.response.list>
InvoiceViewDetailResponse = z.infer<typeof invoiceReadContract.response.detail>
InvoiceViewApiRow         # unchanged, derived from invoicesViewFieldMap
```

Not renamed, not touched: `server/sheets/InvoicesView/**`, `InvoicesView.db-contract.ts` (declares its own local status/billing enums — no import from the contract), `invoicesViewFieldMap`, `invoicesViewJsonColumns`, `invoice-view-sync-client.ts`, `syncInvoiceView`, `InvoiceViewSyncResult`, `PORTAL_SPREADSHEET_ID`.

---

## 2. Backend update path

### 2a. DB contract — `server/sheets/Invoices/Invoices.db-contract.ts`

```
invoicesDbContract
 L writes = { append: true, update: true, delete: false }
 L audit  = { onAppend: ['created_at'], onUpdate: ['updated_at'] }   # valueInput.updated_at is already USER_ENTERED
```
No G Drive registry change: `Invoice.json` carries no `writes` or `audit` key.

### 2b. Port — `server/modules/invoices/invoice.service.ts`

```
interface InvoiceHeaderPort
 L read(query?: ReadQueryDTO<Partial<InvoicesDbRow>>) -> Promise<Array<Partial<InvoicesDbRow>>>
 L append(data: Partial<InvoicesDbRow>) -> Promise<unknown>
 L update(keyValue: string, patch: Partial<InvoicesDbRow>) -> Promise<unknown>   # new, required
```
`getInvoicesRepository()` (SheetRepository) already satisfies it. Every fake `InvoiceHeaderPort` literal in `tests/` must gain an `update` member — see §5.

### 2c. Read service narrowing (required by the merge)

`this.readService = new BaseCrudService<..., never, never, ...>` is constructed with `api: invoiceViewApiContract` today. Passing the merged `invoiceApiContract` fails typecheck (`request.create: ZodType<CreateInvoiceRequest>` is not assignable to `ZodType<never>`) and would bind an update surface to the read-only InvoicesView repository.

```
invoiceReadContract                               # module-local const, declared ABOVE the InvoiceView* type aliases at invoice.service.ts:228 — they read `typeof invoiceReadContract`; not exported to the contract folder
 L { query: invoiceApiContract.query,
     response: { list: invoiceApiContract.response.list, detail: invoiceApiContract.response.detail } }

InvoiceService.constructor
 L readService = new BaseCrudService({ ..., api: invoiceReadContract })
```
`parseOrThrow(invoiceReadContract.query.list, query)` in `listWithDateRange` and `Object.keys(invoiceReadContract.response.list.shape)` in `projectListRow` replace the `invoiceViewApiContract` references one-for-one.

### 2d. Service method

```
INVOICE_UPDATED_BY = 'staff'                        # server constant, mirrors INVOICE_CREATED_BY; never accepted from the client

InvoiceService.updateStatus(invoiceNumber: string, payload: unknown) -> Promise<UpdateInvoiceResponse>
 L if invoiceNumber.trim() === '' -> throw ApiError.notFound('Invoice number is required')
 L parseOrThrow(invoiceUpdateSchema, payload) -> { status }        # throws 422 VALIDATION_ERROR
 L readInvoiceHeader(invoiceNumber) -> Partial<InvoicesDbRow> | null
    L if null -> throw ApiError.notFound('Invoice not found')
 L if current.status === status
    L skip the row write                            # idempotent branch: re-runs the view sync only
   else if current.status !== 'ISSUED'
    L throw ApiError.conflict(`Invoice status ${current.status} cannot be changed`)
   else
    L try invoiceRepository().update(invoiceNumber, { status, updated_by: INVOICE_UPDATED_BY })
      catch
       L classifyWriteFailure(error) -> { certainty, message }
       L throw ApiError.internal(message, { stage: 'invoice_status_write', certainty })
 L syncInvoiceView(invoiceNumber) -> result         # never throws out of this method
    L catch -> result = { outcome: 'failed', certainty: 'unknown', message }
 L return { invoiceNumber, status, viewSynced: result.outcome === 'confirmed' }

private InvoiceService.readInvoiceHeader(invoiceNumber: string) -> Promise<Partial<InvoicesDbRow> | null>
 L invoiceRepository().read({ select: ['invoice_number', 'status'] })   # no GViz where-filter: that builder strips apostrophes from filter values
 L return rows.find((row) => row.invoice_number === invoiceNumber) ?? null
 L read failure propagates                          # NOT swallowed, unlike the advisory create preflight
```

`invoiceNumberAlreadyUsed` is left exactly as it is (unfiltered read, in-memory compare, `catch -> false` so a failed read never blocks create). It does not delegate to `readInvoiceHeader`: the two differ in failure policy.

Never write `deleted_at` / `deleted_by` on this path. `invoiceUpdateSchema` being `.strict()` with a single key is the guard that keeps the now-open row from accepting anything else.

`BaseCrudService.update` is not reused: it is single-sheet with no post-write hook (no place for `syncInvoiceView`), and it projects its response by re-reading the row from the same repository it wrote — invoices write `Invoices` and read `InvoicesView`.

### 2e. Route — `server/modules/invoices/invoice.module.ts`

```
invoiceRoutes.item = new ApiHandler({
 L GET:   existing
 L PATCH: async (req) => ok(await invoiceService.updateStatus(req.params.id, req.body))
})
```
PATCH uses the standard `{ success, data, meta }` envelope via `ok` — same as GET. Only POST keeps its bare-union body. `statusForResponse` is untouched. Failure statuses come from `ApiError` through `ApiHandler`'s existing catch: 422 / 404 / 409 / 500.

### Edge cases — backend

- body with any key other than `status` -> 422 VALIDATION_ERROR (`.strict()`)
- `status` = `PAID` | `UNPAID` | `OVERDUE` | `PARTIALLY_PAID` | `ISSUED` | `DRAFT` -> 422 VALIDATION_ERROR
- empty body / non-object body -> 422 VALIDATION_ERROR
- unknown invoice number -> 404 NOT_FOUND, nothing written
- header read fails -> 500 INTERNAL_ERROR, nothing written
- current status `DRAFT` -> 409 CONFLICT, nothing written
- Branch A, current `CANCELLED` + requested `VOID` (or the reverse) -> 409 CONFLICT
- current status already equals the requested status -> 200, no row write, view sync re-run, `viewSynced` reflects that run
- `writes.update` still false -> `requireWriteCapability` throws a plain `Error` (not `WriteRejectedError`), classified `unknown` -> 500; flipping the flag is mandatory
- row write rejected (`WriteRejectedError`) -> 500, `certainty: 'rejected'`, source unchanged
- row write committed but unreadable (`WriteCommittedUnreadableError`) -> 500, `certainty: 'unknown'`; a repeat PATCH lands on the idempotent branch, so no auto-retry is offered and a manual retry cannot double-write
- view sync fails or is unconfirmed -> 200 with `viewSynced: false`; the source row is authoritative and already changed
- two concurrent PATCHes with the same status -> both 200; the second may take the write branch and rewrite the same value
- two concurrent PATCHes with different statuses (Branch A) -> both may take the write branch; last write wins, no compare-and-swap exists
- PATCH on the collection route `/api/invoices` -> 405 (item handler only)

---

## 3. Frontend migration

| File | Change |
|---|---|
| `src/features/invoices/services/invoice.service.ts` | two imports collapse into one from `@contracts/invoices/invoice-api.schema`; symbols unchanged |
| `src/features/invoices/services/invoice-detail.service.ts` | import path -> `invoice-api.schema`; add `updateInvoiceStatus` |
| `src/features/invoices/types/invoices.types.ts` | import path -> `invoice-api.schema`; `invoiceViewStatusSchema` -> `invoiceStatusSchema` (`InvoiceStatusDto` keeps its name and shape) |
| `src/features/invoices/types/invoice-create.types.ts` | no change |
| `src/features/invoices/utils/invoice-outcome.utils.ts` | no change |
| `src/features/invoices/pages/InvoiceCreatePage.vue` | no change |
| `src/features/invoices/stores/invoice.store.ts` | no change |
| `server/modules/invoices/invoice.service.ts` | single contract import; adds `invoiceReadContract`, `readInvoiceHeader`, `updateStatus`, port `update`; retargets the four `InvoiceView*` type aliases |
| `server/modules/invoices/invoice.module.ts` | no import change; adds PATCH |
| `tests/**` invoice tests | no contract-import change (all already import from `invoice-api.schema`); fakes change — see §5 |

```
updateInvoiceStatus(invoiceNumber: unknown, status: UpdateInvoiceRequest['status']) -> Promise<UpdateInvoiceResponse>
 L normalizeInvoiceNumber(invoiceNumber)          # existing; throws InvalidInvoiceNumberError
 L apiPatch<UpdateInvoiceResponse>(`/api/invoices/${encodeURIComponent(number)}`, { data: { status }, requestSchema: invoiceUpdateSchema })
 L return response                                 # apiPatch unwraps { data }, throws ApiError on !ok
```
One type argument only: `apiPatch<TResponse, TRequest extends z.ZodTypeAny>` infers `TRequest` from `requestSchema` (see `price-list.service.ts:38`).

**No store.** `InvoiceDetailPage.vue` keeps its page-local refs and calls the service directly, as it does today. `App.vue`'s `KeepAlive` `exclude` list does not contain `InvoiceDetailPage`, so the page is cached per route instance; a singleton Pinia store would show invoice B's data on a cached page still mounted for invoice A. Do not add `InvoiceDetailPage` to `exclude`, and do not create `invoice-detail.store.ts`.

---

## 4. Cancel/void UI — `InvoiceDetailPage.vue`

New feature-local files under `src/features/invoices/components/`:

- `InvoiceConfirmDialog.vue` — presentational. Props `open: boolean`, `title: string`, `message: string`, `confirmLabel: string`, `busy: boolean`, `errorMessage: string | null`. Emits `confirm`, `close`. `Teleport` to body, backdrop click + Escape close (both no-ops while `busy`), destructive confirm button. Plain local state — **no route query param, no history API**: this dialog does not need Back-to-close.
- Branch A only: `InvoiceActionsMenu.vue` — trigger + `Teleport` dropdown with `Cancel invoice` / `Void invoice`. Structural copy of `InvoicePaymentsMenu.vue` (outside `pointerdown`, Escape, scroll/resize close, `suspended` prop). Emits `select: ['CANCELLED' | 'VOID']`.

Page state added (all page-local `ref`s, alongside the existing `invoice` / `loading` / `error` / `notFound` / `proofUrl`):

```
pendingStatus  = ref<'CANCELLED' | 'VOID' | null>(null)   # null = dialog closed
updating       = ref(false)
updateError    = ref<string | null>(null)
viewSynced     = ref(true)
```

```
invalidationCopy = {                                       # module-level const in the page
 L CANCELLED: { title: 'Cancel invoice', confirmLabel: 'Cancel invoice', noun: 'cancelled' }
 L VOID:      { title: 'Void invoice',   confirmLabel: 'Void invoice',   noun: 'void' }
}
dialogCopy = computed(() => pendingStatus === null ? null : invalidationCopy[pendingStatus])

InvoiceDetailPage.vue
 L loadInvoice()                                            # existing, unchanged, plus: viewSynced = true, updateError = null, pendingStatus = null, updating = false
 L watch(() => props.invoiceNumber, loadInvoice, { immediate: true })   # unchanged; no onActivated (page is cached, refetch stays prop-driven)
 L canInvalidate = computed(status !== 'CANCELLED' && status !== 'VOID' && status !== 'DRAFT')
 L header <section>: trailing action element before the date-chip column
    L Branch A -> <InvoiceActionsMenu v-if="canInvalidate" :suspended="pendingStatus !== null || proofUrl !== null" @select="openDialog" />
      Branch B -> <button v-if="canInvalidate" icon="cancel" @click="openDialog('CANCELLED')" />
 L openDialog(status)
    L updateError = null
    L pendingStatus = status
 L inline error strip: v-if="updateError !== null && pendingStatus === null"   # between the header <section> and <InvoiceCustomerCard>, inside the v-else branch
    L text updateError + dismiss button -> updateError = null
 L sync warning banner: v-if="!viewSynced" directly below the error strip, above <InvoiceCustomerCard>
    L text 'Customer view not updated yet' + 'Try again' button, :disabled="updating" -> retrySync()
 L <InvoiceConfirmDialog v-if="dialogCopy !== null && invoice !== null" ... />   # v-if gates every binding below; `:open` alone does not stop expression evaluation
      :open="true"
      :title="dialogCopy.title"
      :message="`${invoice.invoiceNumber} will be marked ${dialogCopy.noun} and can no longer be paid. This cannot be undone.`"
      :confirm-label="dialogCopy.confirmLabel"
      :busy="updating"
      :error-message="updateError"
      @confirm="confirmInvalidation" @close="pendingStatus = null"
 L confirmInvalidation()
    L if invoice === null || pendingStatus === null -> return
    L forInvoice = props.invoiceNumber; target = pendingStatus   # the mutation guard is the invoice identity, NOT latestRequest — loadInvoice bumps that counter itself
    L updating = true; updateError = null
    L try updateInvoiceStatus(invoice.invoiceNumber, target) -> response
       L if props.invoiceNumber !== forInvoice -> return          # page switched to another invoice; drop the result
       L invoice.status = response.status                         # API-supplied fact, not re-derived
       L viewSynced = response.viewSynced
       L pendingStatus = null
      catch error
       L if props.invoiceNumber !== forInvoice -> return
       L ApiError 409 -> pendingStatus = null; await loadInvoice(); if props.invoiceNumber === forInvoice -> updateError = 'This invoice can no longer be changed'   # set AFTER the reload, which clears it
       L ApiError 404 -> pendingStatus = null; notFound = true
       L else -> updateError = 'Unable to update this invoice'    # dialog stays open, confirm re-enabled
    L finally if props.invoiceNumber === forInvoice -> updating = false
 L retrySync()
    L if invoice === null -> return
    L if invoice.status !== 'CANCELLED' && invoice.status !== 'VOID' -> return   # narrows to UpdateInvoiceRequest['status']
    L forInvoice = props.invoiceNumber
    L updating = true
    L try updateInvoiceStatus(invoice.invoiceNumber, invoice.status) -> response   # same status -> idempotent branch, re-runs the view sync only
       L if props.invoiceNumber !== forInvoice -> return
       L viewSynced = response.viewSynced
      catch -> leave the banner up, no dialog
    L finally if props.invoiceNumber === forInvoice -> updating = false
 L footer status bar: container styling unchanged (hard-coded bg-primary); only statusStyle().icon and statusLabel() change, and both already carry CANCELLED and VOID
```

After success: `canInvalidate` turns false so the trigger disappears, the footer reads `Cancelled` / `Void`, and `InvoicePaymentsMenu` keeps rendering historical payments unchanged.

### Edge cases — UI

- `status === 'DRAFT'` -> no trigger rendered (footer is hidden anyway)
- `status === 'CANCELLED' | 'VOID'` -> no trigger rendered, banner is the only remaining control
- dialog open while `updating` -> backdrop, Escape, and Cancel are inert; confirm shows a spinner
- 409 -> dialog closes, detail reloads, `updateError` rendered by the inline error strip
- 404 -> page switches to the existing `Invoice not found` state
- network / 500 -> dialog stays open with `errorMessage`; confirm is safe to press again (repeat lands on the idempotent branch)
- `viewSynced === false` -> banner persists until a retry returns `viewSynced: true`; the local status already reads the new value
- `Try again` fails -> banner stays, no dialog, button re-enabled by the `finally`
- proof lightbox open at the same time (Branch A) -> `suspended` unhooks the menu listeners, same as today
- rapid double confirm -> `updating` disables the button; no second request
- invoice number changes mid-request (cached page, prop switch) -> `props.invoiceNumber` no longer matches `forInvoice`, so the completion handler returns without touching the newly loaded invoice; `loadInvoice`'s own `latestRequest` guard is left alone

### SHARED GAPS

`src/shared/components/` currently holds `AppHeader`, `BaseSwipeCard`, `CardLeadingIcon`, `FormInput`, `FormLabel`, `FormOptionGrid`, `FormSwitch`, `FormTextarea`, `GenericTabs`, `ListContainer`, `NavSidebar`. There is no confirm/destructive-action dialog and no overflow menu, so both new components are feature-local. `src/shared/layouts/BaseOverlay.vue` is a slide/full overlay shell, not a centered confirm modal, and must not be modified to become one.

---

## 5. Test plan

Must pass untouched:
- `tests/server/workflows/invoices/invoice-api.workflow.dry-test.ts`
- `tests/server/workflows/invoices/invoice-read.workflow.dry-test.ts`
- `tests/frontend/invoices/invoice-api-compat.workflow.dry-test.ts`
- `tests/web/unit/features/invoices/utils/invoice-price-list.utils.dry-test.ts`
- `tests/server/workflows/invoices/invoice-sheets-api.workflow.dry-test.ts` — injects a real `SheetRepository` at `:187`, which already has `update`
- `tests/server/integration/invoice-number-preflight.ts` — injects `getInvoicesRepository()` at `:36`, which already has `update`

Must change (each declares a typed `InvoiceHeaderPort` object literal that now needs an `update` member; no other edit):
- `tests/server/unit/modules/invoices/invoice-create-preflight.dry-test.ts:35`
- `tests/server/unit/modules/invoices/invoice.service.dry-test.ts:60`
- `tests/server/unit/sheets/invoice-sheets-api-errors.dry-test.ts:34`
- `tests/server/workflows/invoices/invoice-create.workflow.dry-test.ts:53`

Also change:
- `tests/server/unit/modules/invoices/invoice-read.dry-test.ts:44` — comment renamed to `invoiceDetailResponseSchema`
- `tests/server/unit/modules/invoices/invoice-view-sync-client.dry-test.ts` — only if it constructs an `InvoiceHeaderPort`

Create-path behaviour must not shift: `invoice-create-preflight.dry-test.ts` asserts the unfiltered `select: ['invoice_number']` read, the in-memory exact compare, and fail-open on read error. Those assertions stay green unchanged.

New:
- `tests/server/unit/modules/invoices/invoice-status-update.dry-test.ts` — `.strict()` rejection of extra keys; rejection of every non-updatable status; 404 on missing row; 409 on `DRAFT`; 409 on the other invalidation status (Branch A); idempotent branch performs no row write but does re-sync; `updated_by` present in the patch; `deleted_at`/`deleted_by` absent from the patch; write error -> 500 with `certainty`; sync failure -> `viewSynced: false`
- `tests/server/workflows/invoices/invoice-status-update.workflow.dry-test.ts` — PATCH through `ApiHandler`: `{ success, data, meta }` envelope, status codes, 405 on the collection route
- `tests/server/unit/contracts/invoice-contract.dry-test.ts` — `invoiceApiContract` exposes all four write slots; `response.list`/`detail`/`create`/`update` each expose `.shape`; `invoiceListResponseSchema` key order still matches `invoiceDetailResponseSchema`

---

## 6. Implementation steps

Backend (independently verifiable):
1. Merge contract file, delete `invoice-view-api.schema.ts`, apply the rename table, retarget the four server-local `InvoiceView*` aliases, add `invoiceReadContract`. -> `npm run typecheck:api`
2. Flip `writes.update`, add `audit.onUpdate: ['updated_at']`. -> `npm run typecheck:api`
3. Add `InvoiceHeaderPort.update` and an `update` member to the four typed fakes listed in §5. -> `npm run typecheck:api`
4. Add `readInvoiceHeader`, `INVOICE_UPDATED_BY`, `updateStatus`. -> `npm run typecheck:api`
5. Add PATCH to `invoiceRoutes.item`. -> `npm run typecheck:api`
6. Add the three new test files, then run the full dry gate:
   - `npx tsx tests/server/unit/modules/invoices/invoice-status-update.dry-test.ts`
   - `npx tsx tests/server/workflows/invoices/invoice-status-update.workflow.dry-test.ts`
   - `npx tsx tests/server/unit/contracts/invoice-contract.dry-test.ts`
   - `npx tsx` on each: `tests/server/unit/modules/invoices/invoice-create-preflight.dry-test.ts`, `tests/server/unit/modules/invoices/invoice.service.dry-test.ts`, `tests/server/unit/modules/invoices/invoice-read.dry-test.ts`, `tests/server/unit/modules/invoices/invoice-view-sync-client.dry-test.ts`, `tests/server/unit/sheets/invoice-sheets-api-errors.dry-test.ts`, `tests/server/workflows/invoices/invoice-create.workflow.dry-test.ts`, `tests/server/workflows/invoices/invoice-sheets-api.workflow.dry-test.ts`, `tests/server/workflows/invoices/invoice-api.workflow.dry-test.ts`, `tests/server/workflows/invoices/invoice-read.workflow.dry-test.ts`, `tests/frontend/invoices/invoice-api-compat.workflow.dry-test.ts`
   - `npx tsx --tsconfig jsconfig.json tests/web/unit/features/invoices/utils/invoice-price-list.utils.dry-test.ts`
   - `tests/server/integration/invoice-number-preflight.ts` is a live-sheet script, not part of this gate (`node --env-file=.env.local --import=tsx/esm <path>`, run manually only)

Frontend (independently verifiable, starts after step 1):
7. Rewrite the three `src/features/invoices` import sites. -> `npm run build`
8. Add `updateInvoiceStatus` to `invoice-detail.service.ts`. -> `npm run build`
9. Add `InvoiceConfirmDialog.vue` (+ `InvoiceActionsMenu.vue` under Branch A). -> `npm run build`
10. Wire the trigger, dialog, banner, and new page refs into `InvoiceDetailPage.vue`. -> `npm run build`

Full gate: `npm run typecheck:api` + `npm run build`.

## Out of Scope

- Nested update (invoice header + items replaced together) — `SheetRepository.delete()` throws, no `spreadsheets:batchUpdate` access, `InvoiceItems` has no soft-delete column and `writes.update: false`
- Row deletion and soft delete; `deleted_at` / `deleted_by`
- `DRAFT` status, draft-editable invoices, reverting `ISSUED`
- Writing `PAID` / `UNPAID` / `OVERDUE` / `PARTIALLY_PAID` from any client
- Compare-and-swap / optimistic concurrency on the Invoices row
- A Pinia store for invoice detail; adding `InvoiceDetailPage` to the `KeepAlive` `exclude` list
- Apps Script changes (`appscript/MagicwashPortal/InvoiceViewSync.js` lives in the parent repo `C:\MagicwashGemini`, not in `webapp-vue`)
- `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`
- `src/shared/components/`, `src/shared/layouts/`
- Renaming `server/sheets/InvoicesView/**` or any `invoicesView*` server symbol
- `contracts/customer-packages/customer-package-view-api.schema.ts` (same view-naming issue, separate task)
- Migrating `tests/frontend/invoices/` to `tests/web/`
- Invoice list page and `useInvoiceStore`

## Status

FINAL — pending the CANCELLED/VOID branch answer (naming only; structure is settled).
