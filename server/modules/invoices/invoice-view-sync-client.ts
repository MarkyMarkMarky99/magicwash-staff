import { requireEnv } from '../../shared/utils/env.js'

const REQUEST_TIMEOUT_MS = 15_000

export type InvoiceViewSyncResult =
  | { outcome: 'confirmed' }
  | { outcome: 'failed'; message: string }

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
      message: `Invoice view sync request failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  if (!response.ok) {
    return {
      outcome: 'failed',
      message: `Invoice view sync HTTP ${response.status} ${response.statusText}`,
    }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { outcome: 'failed', message: 'Invoice view sync response was not valid JSON' }
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { outcome: 'failed', message: 'Invoice view sync response had an invalid shape' }
  }

  const result = body as Record<string, unknown>
  if (result.ok !== true) {
    return {
      outcome: 'failed',
      message: typeof result.message === 'string'
        ? result.message
        : 'Invoice view sync was rejected',
    }
  }

  return { outcome: 'confirmed' }
}
