import type { CreateInvoiceItemsFailed, CreateInvoiceResponse } from '@contracts/invoices/invoice-api.schema'

/**
 * Retry-eligibility policy for a `CreateInvoiceResponse`, extracted out of
 * `InvoiceCreatePage.vue` so it is directly unit-testable (business logic
 * out of components, per this repo's architecture rules) and so
 * `tests/frontend/invoices/invoice-api-compat.workflow.dry-test.ts` (Layer 5,
 * `docs/invoice-module-refactor-plan.md`) exercises the EXACT function the
 * page uses, not a re-implementation of its rule.
 *
 * - `validation_error` is always retry-safe: nothing was ever written.
 * - `items_write_failed` is retry-safe ONLY when `certainty === 'rejected'` —
 *   a definite gateway answer that the batch was never written. An
 *   `'unknown'` certainty means the batch may already be in the sheet; a
 *   plain retry could double every line item, so it must NEVER be offered.
 * - Every other kind (`invoice_write_failed`, `order_link_failed`,
 *   `invoice_view_sync_failed`, `created`) is never retry-safe regardless of
 *   `certainty` — those outcomes mean at least the InvoiceItem batch (and
 *   often the Invoice header too) already exist, so resubmitting the form
 *   would create a duplicate.
 */
export function canRetryInvoiceOutcome(result: CreateInvoiceResponse | null): boolean {
  if (!result) return false
  if (result.kind === 'validation_error') return true
  if (result.kind === 'items_write_failed') return result.certainty === 'rejected'
  return false
}

/**
 * Builds the outcome `handleSubmit()` shows when `createInvoice()` itself
 * throws — a genuine network-level failure (lost connection, a platform
 * timeout/504 with no body) rather than a well-formed `CreateInvoiceResponse`
 * from the server. This is the case MOST likely to have actually persisted
 * the batch server-side despite the client never seeing a response, so
 * `certainty` is ALWAYS `'unknown'` here — never `'rejected'`, which would
 * wrongly tell `canRetryInvoiceOutcome()` a plain retry is safe.
 */
export function synthesizeNetworkFailureOutcome(
  message = 'Could not reach the server, or the response was lost. This may already have been saved.',
): CreateInvoiceItemsFailed {
  return { kind: 'items_write_failed', message, certainty: 'unknown' }
}
