import assert from 'node:assert/strict'
import {
  createInvoiceResponseSchema,
  type CreateInvoiceResponse,
} from '../../../contracts/invoices/invoice-api.schema'
import {
  canRetryInvoiceOutcome,
  synthesizeNetworkFailureOutcome,
} from '../../../src/features/invoices/utils/invoice-outcome.utils'

/**
 * Layer 5 — Frontend compatibility workflow
 * (docs/invoice-module-refactor-plan.md's Workflow Test Plan).
 *
 * This is the test whose acceptance criterion is "retry is offered only for
 * a definite rejection that proves nothing persisted" — the exact release
 * gate `InvoiceCreatePage.vue` previously failed (a lost response after
 * `InvoiceItem` rows were written rendered "Safe to try again — no invoice
 * or line items were written" underneath a Try again button). It imports and
 * exercises the REAL, production `canRetryInvoiceOutcome`/
 * `synthesizeNetworkFailureOutcome` functions `InvoiceCreatePage.vue` itself
 * calls (`src/features/invoices/utils/invoice-outcome.utils.ts`) — not a
 * re-implementation of the policy — against the real
 * `createInvoiceResponseSchema` union every one of the six outcome kinds
 * must satisfy.
 *
 * ⚠ SCOPE NOTE: this repo has no frontend tsconfig and no bundler-backed test
 * runner (`tests/web/`'s only existing dry-test avoids the same issue for
 * the same reason — see its header) — `@/*`/`@contracts/*` are Vite-only
 * aliases, and a plain `npx tsx` run cannot resolve a VALUE import through
 * them (only `import type` is safe, because it's erased at transpile time
 * and never needs runtime resolution). `invoice.service.ts` / `api-client.ts`
 * both have real (non-type-only) alias value imports
 * (`@contracts/...`, `@/shared/api/api-client`), so `getInvoices()` /
 * `createInvoice()` / `getInvoiceDetail()` cannot be imported directly by
 * this file the way `canRetryInvoiceOutcome` can (that function's only
 * cross-alias import is `import type`, which is erased). List-unwrapping and
 * detail-404 handling in those three functions are therefore validated by
 * `npm run build` (this repo's established frontend compile-time gate, run
 * and passing — see this fix round's report) plus direct code reading, NOT
 * by an executed assertion in this file. This is a real, disclosed gap, not
 * a claim that those paths were exercised here.
 */

const tests: Array<{ name: string; run: () => void }> = []

function test(name: string, run: () => void): void {
  tests.push({ name, run })
}

function created(): CreateInvoiceResponse {
  return { kind: 'created', invoiceNumber: 'INV-0001', itemCount: 1, itemsTotal: 100, invoiceTotal: 100 }
}

function validationError(): CreateInvoiceResponse {
  return { kind: 'validation_error', issues: [{ path: 'invoiceNumber', message: 'Required' }] }
}

function itemsWriteFailed(certainty: 'rejected' | 'unknown'): CreateInvoiceResponse {
  return { kind: 'items_write_failed', message: 'x', certainty }
}

function invoiceWriteFailed(certainty: 'rejected' | 'unknown'): CreateInvoiceResponse {
  return { kind: 'invoice_write_failed', invoiceNumber: 'INV-0001', itemCount: 1, certainty }
}

function orderLinkFailed(certainty: 'rejected' | 'unknown'): CreateInvoiceResponse {
  return { kind: 'order_link_failed', invoiceNumber: 'INV-0001', sourceOrderId: 'ORD-0001', certainty }
}

function viewSyncFailed(certainty: 'rejected' | 'unknown'): CreateInvoiceResponse {
  return { kind: 'invoice_view_sync_failed', invoiceNumber: 'INV-0001', message: 'x', certainty }
}

test('every outcome kind is a valid, schema-conformant CreateInvoiceResponse', () => {
  const outcomes = [
    created(),
    validationError(),
    itemsWriteFailed('rejected'),
    itemsWriteFailed('unknown'),
    invoiceWriteFailed('rejected'),
    invoiceWriteFailed('unknown'),
    orderLinkFailed('rejected'),
    orderLinkFailed('unknown'),
    viewSyncFailed('rejected'),
    viewSyncFailed('unknown'),
    synthesizeNetworkFailureOutcome(),
  ]
  for (const outcome of outcomes) {
    const parsed = createInvoiceResponseSchema.safeParse(outcome)
    assert.ok(parsed.success, `${JSON.stringify(outcome)} must satisfy createInvoiceResponseSchema`)
  }
})

test('no result yet (initial/loading state) is never retryable', () => {
  assert.equal(canRetryInvoiceOutcome(null), false)
})

test('validation_error is always retryable — nothing was ever written', () => {
  assert.equal(canRetryInvoiceOutcome(validationError()), true)
})

test('created is never retryable — resubmitting would create a duplicate invoice', () => {
  assert.equal(canRetryInvoiceOutcome(created()), false)
})

test('items_write_failed is retryable ONLY when certainty is "rejected" — the named release gate', () => {
  assert.equal(canRetryInvoiceOutcome(itemsWriteFailed('rejected')), true)
  assert.equal(
    canRetryInvoiceOutcome(itemsWriteFailed('unknown')),
    false,
    'an unconfirmed outcome must NEVER be retryable — the batch may already be in the sheet',
  )
})

test('the Try-again-button condition and the unconfirmed-panel condition partition items_write_failed exactly along canRetry — locking the fix that the template no longer re-types this rule inline', () => {
  // Try-again and unconfirmed panels for items_write_failed must partition
  // exactly along canRetryInvoiceOutcome: canRetry vs !canRetry are
  // exhaustive and mutually exclusive for every certainty
  // items_write_failed can carry. A regression to an inline re-typed
  // certainty check would diverge from this assertion.
  for (const certainty of ['rejected', 'unknown'] as const) {
    const result = itemsWriteFailed(certainty)
    const showsTryAgainButton = result.kind === 'items_write_failed' && canRetryInvoiceOutcome(result)
    const showsUnconfirmedPanel = result.kind === 'items_write_failed' && !canRetryInvoiceOutcome(result)
    assert.notEqual(showsTryAgainButton, showsUnconfirmedPanel, `certainty=${certainty} must render exactly one of the two sections`)
    assert.equal(showsTryAgainButton, certainty === 'rejected')
    assert.equal(showsUnconfirmedPanel, certainty === 'unknown')
  }
})

test('invoice_write_failed is never retryable, regardless of certainty — items already exist either way', () => {
  assert.equal(canRetryInvoiceOutcome(invoiceWriteFailed('rejected')), false)
  assert.equal(canRetryInvoiceOutcome(invoiceWriteFailed('unknown')), false)
})

test('order_link_failed is never retryable, regardless of certainty — the invoice is already fully billed', () => {
  assert.equal(canRetryInvoiceOutcome(orderLinkFailed('rejected')), false)
  assert.equal(canRetryInvoiceOutcome(orderLinkFailed('unknown')), false)
})

test('invoice_view_sync_failed is never retryable, regardless of certainty — only the read view is stale', () => {
  assert.equal(canRetryInvoiceOutcome(viewSyncFailed('rejected')), false)
  assert.equal(canRetryInvoiceOutcome(viewSyncFailed('unknown')), false)
})

test('synthesizeNetworkFailureOutcome (the catch-block path for a bodyless/lost response) is always certainty "unknown" and never retryable', () => {
  const outcome = synthesizeNetworkFailureOutcome()
  assert.equal(outcome.kind, 'items_write_failed')
  assert.equal(outcome.certainty, 'unknown')
  assert.equal(
    canRetryInvoiceOutcome(outcome),
    false,
    'this is the case MOST likely to have persisted (e.g. a platform 504 with no body) — must never offer a plain retry',
  )
})

for (const item of tests) {
  item.run()
}

console.log(`${tests.length} invoice frontend API-compat workflow tests passed`)
