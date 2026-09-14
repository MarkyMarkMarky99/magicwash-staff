import type { CreateInvoiceItemsFailed, CreateInvoiceResponse } from '@contracts/invoices/invoice-api.schema'

/**
 * `validation_error` is retry-safe because nothing was written.
 * `items_write_failed` is retry-safe only when `certainty` is `'rejected'`.
 * Every other outcome may have persisted data and must not offer a plain retry.
 */
export function canRetryInvoiceOutcome(result: CreateInvoiceResponse | null): boolean {
  if (!result) return false
  if (result.kind === 'validation_error') return true
  if (result.kind === 'items_write_failed') return result.certainty === 'rejected'
  return false
}

/** A missing or unreadable response has unknown certainty and is never retry-safe. */
export function synthesizeNetworkFailureOutcome(
  message = 'Could not reach the server, or the response was lost. This may already have been saved.',
): CreateInvoiceItemsFailed {
  return { kind: 'items_write_failed', message, certainty: 'unknown' }
}
