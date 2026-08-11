import { requireEnv } from '../../shared/utils/env.js'

const REQUEST_TIMEOUT_MS = 15_000

/**
 * `certainty` uses the same rejected/unknown vocabulary as the sheet write
 * services:
 *   - 'rejected' — the response is recognizably the endpoint's OWN failure
 *     shape: an explicit `ok: false`, or a known `error`/`message` reason
 *     string. A definite, understood rejection.
 *   - 'unknown'  — no definite answer came back at all: network failure,
 *     timeout, non-2xx, unparsable body, an unexpected response shape, OR a
 *     well-formed object whose `ok` field is simply missing/not `true` with
 *     no recognizable reason either (e.g. endpoint version skew). A response
 *     this client doesn't recognize is not evidence of rejection — it must
 *     not be upgraded to 'rejected' just because `ok !== true`.
 * Both map to the SAME `invoice_view_sync_failed` outcome either way — the
 * source invoice/items/order-link are already complete by the time this
 * runs, so the UI never offers a retry here regardless of `certainty` (see
 * `contracts/invoices/invoice-api.schema.ts`).
 */
export type InvoiceViewSyncResult =
  | { outcome: 'confirmed' }
  | { outcome: 'failed'; message: string; certainty: 'rejected' | 'unknown' }

/**
 * Refreshes the materialized InvoicesView for one invoice. This is the final
 * external write in the create flow; source writes and the order link must
 * already be complete before the view is refreshed.
 */
export async function syncInvoiceView(invoiceNumber: string): Promise<InvoiceViewSyncResult> {
  let response: Response
  try {
    const url = requireEnv('APPSCRIPT_INVOICE_VIEW_SYNC_URL')
    response = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ invoiceNumber }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    return {
      outcome: 'failed',
      certainty: 'unknown',
      message: `Invoice view sync request failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  if (!response.ok) {
    return {
      outcome: 'failed',
      certainty: 'unknown',
      message: `Invoice view sync HTTP ${response.status} ${response.statusText}`,
    }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { outcome: 'failed', certainty: 'unknown', message: 'Invoice view sync response was not valid JSON' }
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { outcome: 'failed', certainty: 'unknown', message: 'Invoice view sync response had an invalid shape' }
  }

  const result = body as Record<string, unknown>
  if (result.ok === true) {
    return { outcome: 'confirmed' }
  }

  // The Apps Script endpoint names its reason field `error`, NOT `message`
  // (see appscript/MagicwashPortal/InvoiceViewSync.js) — reading only
  // `message` would silently collapse every real reason ("invoice not
  // found", "invoice is deleted", a missing Script Property) into the
  // generic fallback below. `message` stays as a second choice so a future
  // response shape using it still surfaces something useful.
  const reason = [result.error, result.message].find(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0,
  )

  if (result.ok === false || reason !== undefined) {
    return { outcome: 'failed', certainty: 'rejected', message: reason ?? 'Invoice view sync was rejected' }
  }

  return {
    outcome: 'failed',
    certainty: 'unknown',
    message: 'Invoice view sync response had an unrecognized shape',
  }
}
