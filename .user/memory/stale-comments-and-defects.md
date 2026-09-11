# Stale source comments and real defects — open

Two separate things, both left untouched by the comment-cleanup rounds.

**Every row below is a claim from a read-only audit, not a verified fact.** Open the code and the
cited evidence before acting. The same audit was already wrong twice elsewhere. If a comment does
not say what the row claims, fix the row — do not delete the comment.

Full context and the audit's other tables: `.user/memory/doc-comment-docs-work.md`.

## Real code defects — 2

| Location | Defect |
|---|---|
| `src/shared/api/persistent-cache.ts:77-83` | The parse guard checks object-ness and that `t` is a number. `parsed.v` is never validated, so a shape-mismatched value passes through. |
| `src/shared/api/persistent-cache.ts:175-189` | If `removeItem` throws, the persisted entry survives and `promoteFromStorage` reads it back into memory. The next read does not revalidate. Promotion: `src/shared/api/response-cache.ts:78-99,144-157`. |

## Comments that contradict the code — 12

These still sit in the source. Each states something the code does not do, which is exactly the
failure mode the doc-in-code rule exists to prevent: a delegated agent reads the prose as truth.

| Location | What the comment claims | What the code does |
|---|---|---|
| `src/features/invoices/pages/InvoiceCreatePage.vue:62-68` | An invoice-number format and example | `:77` emits ``INV${yy}${mm}${digits}`` with eight random digits; the example does not match. |
| `src/features/invoices/services/invoice.service.ts:15` | Current-page length is the dataset total | `:27` sets `total: items.length`, against `docs/design/patterns/list-pages.md` — `## Pagination`. |
| `src/features/invoices/services/invoice-price-list.service.ts:18-22` | `perPage: 1000` is a sufficient bound | `:26` uses `perPage: 1000`; `perPage` alone is not a real bound. |
| `src/features/invoices/types/invoice-create.types.ts:8-20` | Legacy invoice types are avoided because the statuses are incompatible | `server/sheets/Invoices/Invoices.db-contract.ts:11` defines `status: invoiceStatusSchema`, and `contracts/invoices/invoice-api.schema.ts:10-15` includes `UNPAID`/`PAID`. |
| `src/features/invoices/utils/invoice-price-list.utils.ts:165-170` | The predicate identifies an untouched placeholder | `:173-177` checks neither `unit` nor `unitOption`, so "untouched" is overstated. |
| `src/features/orders/composables/use-corner-editor.ts:64-65` | A mismatch path is dead | No mismatch branch exists; `:62` and `:66-68` only default or scale-map the quad. |
| `src/features/customers/components/CustomerCard.vue:41-43` | This is one of three writers to the shared store | Five calls across four files: `OrderHistoryCustomerCard.vue:23`, `CustomerDetailPage.vue:128,139`, `InvoiceCreatePage.vue:273`. |
| `src/features/customer-packages/stores/customer-package-purchase.store.ts:61` | The package invoice uses a three-day payment term | `InvoiceCreatePage.vue:86-89` shows the three-day value belongs to the invoice form and may be shortened. |
| `src/features/customer-packages/components/CustomerPackageExtraFilter.vue:21-22` | The trigger sits beside the create button | Trigger is in `#search-actions` (`CustomerPackageListPage.vue:28-30`); the create button is in `#actions` (`:32-41`). |
| `src/features/packages/services/package.service.ts:34` | Customer-package data depends on the Packages catalog | `server/modules/customer-packages/customer-package-assembly.ts:90` maps package fields but returns no price. |
| `src/features/packages/services/package.service.ts:48` | The same dependency, on update | Same evidence; invalidation happens at `package.service.ts:49`. |
| `src/features/price-list/components/PriceListServiceFilter.vue:23-24` | The trigger sits beside the create button | Trigger is in `#search-actions` (`PriceListPage.vue:119-125`); the create button is in `#actions` (`:127-139`). |

Nine further rows the audit marked STALE were never re-checked; treat them the same way.
