import { requireEnv } from '../../shared/utils/env.js'
import type {
  InvoiceGatewayAppendRequest,
  InvoiceGatewayAppendResponse,
  InvoiceGatewayTarget,
  InvoiceItemRow,
  InvoiceRow,
} from './invoice.contract.js'

/**
 * Thin POST client for the SheetLib gateway that `Invoice`/`InvoiceItem` are
 * written through. This is a DIFFERENT envelope and a DIFFERENT Apps Script
 * deployment than `GSheetRepository`'s `{ action, sheet, data }` →
 * `{ success, data }`, used by every other module in this app — see
 * `invoice.contract.ts`'s header comment. Do not route these targets through
 * `GSheetRepository`.
 *
 * Every gateway response is HTTP 200, including errors — this client never
 * throws on a well-formed error response; it resolves to the parsed
 * `{ status: 'error', message }` body and lets the caller (the service)
 * decide what that means for the write sequence. It only rejects (via a
 * caught non-2xx / network failure) for a genuine transport failure, which
 * this module also folds into an `{ status: 'error' }`-shaped result so
 * callers have one branch to check, not two.
 */

const REQUEST_TIMEOUT_MS = 15_000

async function postToInvoiceGateway<TRow>(
  target: InvoiceGatewayTarget,
  data: TRow | TRow[],
): Promise<InvoiceGatewayAppendResponse> {
  const url = requireEnv('APPSCRIPT_GATEWAY_URL')
  const request: InvoiceGatewayAppendRequest<TRow> = {
    resource: 'sheet',
    action: 'APPEND',
    target,
    data,
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      // Apps Script rejects the JSON preflight; text/plain avoids it while
      // the body is still a JSON string Apps Script reads via
      // e.postData.contents. Matches src/utils/gateway.js's transport.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    return {
      status: 'error',
      message: `Gateway request failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  if (!response.ok) {
    return { status: 'error', message: `Gateway HTTP ${response.status} ${response.statusText}` }
  }

  try {
    return (await response.json()) as InvoiceGatewayAppendResponse
  } catch {
    return { status: 'error', message: 'Gateway response was not valid JSON' }
  }
}

/**
 * Writes every `InvoiceItem` row for one invoice as a SINGLE batched APPEND —
 * never a loop of single-row requests. SheetLib validates the whole array
 * before writing any of it, so a rejected batch leaves the sheet untouched
 * (see `invoice.contract.ts` point 4). Call this BEFORE `appendInvoice`.
 */
export function appendInvoiceItems(rows: InvoiceItemRow[]): Promise<InvoiceGatewayAppendResponse> {
  return postToInvoiceGateway<InvoiceItemRow>('InvoiceItem', rows)
}

/**
 * Writes the single `Invoice` header row. Call ONLY after `appendInvoiceItems`
 * has resolved with `status: 'ok'` — see `invoice.contract.ts`'s write-
 * sequence comment for why the ordering is load-bearing, not incidental.
 */
export function appendInvoice(row: InvoiceRow): Promise<InvoiceGatewayAppendResponse> {
  return postToInvoiceGateway<InvoiceRow>('Invoice', row)
}
