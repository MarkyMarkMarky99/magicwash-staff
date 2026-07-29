import { requireEnv } from '../../shared/utils/env.js'

/**
 * Thin POST client for the SheetLib gateway that marks an `OrderForm` row as
 * invoiced. Sibling to `order.repository.ts` in this folder, but writes to a
 * DIFFERENT sheet (`OrderForm`, PK `id`) than that file reads (`OrdersView`),
 * and does not go through `GSheetRepository` — same reason
 * `invoice.gateway-client.ts` doesn't: this speaks the SheetLib gateway
 * envelope (`{ resource, action, target, ... }` → `{ status: 'ok' | 'error' }`)
 * directly, against the same `APPSCRIPT_GATEWAY_URL` deployment used by
 * `Invoice`/`InvoiceItem`/`Payment`, not `GSheetRepository`'s
 * `{ action, sheet, data }` → `{ success }` envelope used by every CRUD
 * module in this app.
 *
 * Authoritative schema: `G:\My Drive\Magicwash\Database\GoogleSheets\OrderForm.json`.
 * PK is `id` — the same identifier that already flows through invoice
 * creation as `sourceOrderId` (OrdersView, which is what staff browse, is
 * itself built from OrderForm rows). The column this module writes is
 * `invoice_id`, NOT `invoice_number` — `OrderForm.json` has
 * `additionalProperties: false` and no `invoice_number` property. The value
 * stored in `invoice_id` is still our `Invoice.invoice_number` string; only
 * the column name differs.
 */

const REQUEST_TIMEOUT_MS = 15_000

interface OrderFormGatewayUpdateRequest {
  resource: 'sheet'
  action: 'UPDATE'
  target: 'OrderForm'
  /** OrderForm.id — the same value already carried as CreateInvoiceRequest.sourceOrderId. */
  key_value: string
  data: {
    /** Our Invoice.invoice_number string, stored under OrderForm's own column name. */
    invoice_id: string
    /**
     * NOT auto-stamped by SheetLib on UPDATE — must always be sent (unlike
     * `updated_at`, which SheetLib auto-stamps the same way it auto-stamps
     * `created_at` on APPEND; see `SheetService.js`).
     */
    updated_by: string
  }
}

interface OrderFormGatewayOk {
  resource?: 'sheet'
  status: 'ok'
  target?: string
  updated_range?: string
}

interface OrderFormGatewayError {
  status: 'error'
  message: string
}

type OrderFormGatewayResponse = OrderFormGatewayOk | OrderFormGatewayError

/**
 * Outcome of one `markOrderInvoiced` call. Same `ok`/`error` vocabulary the
 * gateway itself replies with (see `invoice.gateway-client.ts`), split into
 * three because the caller (`invoice.service.ts`) needs to tell "the gateway
 * answered and refused" apart from "no answer ever came back":
 *
 *   - confirmed  the gateway returned `status: 'ok'` — OrderForm.invoice_id
 *                is updated.
 *   - not_sent   the gateway answered with an explicit `status: 'error'` —
 *                a definite rejection (bad key, failed validation, etc.);
 *                nothing was written.
 *   - unknown    no definitive answer came back at all (network failure,
 *                non-2xx, an unparsable body, or a timeout) — Apps Script
 *                may or may not have applied the write; the caller cannot
 *                tell which.
 *
 * From `invoice.service.ts`'s point of view every non-`confirmed` outcome is
 * a failure reported the same way (`order_link_failed`) — see that module
 * for why none of them may ever be offered a retry: the invoice itself is
 * already fully and correctly written by the time this call happens.
 */
export type MarkOrderInvoicedResult =
  | { outcome: 'confirmed' }
  | { outcome: 'not_sent'; message: string }
  | { outcome: 'unknown'; message: string }

/**
 * Marks one `OrderForm` row as invoiced. Never throws: every outcome —
 * success, a gateway-level rejection, or a transport failure — resolves to a
 * `MarkOrderInvoicedResult`, the same non-throwing, dispatch-on-`status`
 * discipline `invoice.gateway-client.ts` uses for its own writes. Call this
 * ONLY after the `Invoice` header row write has already succeeded (see
 * `invoice.service.ts`'s write sequence).
 */
export async function markOrderInvoiced(
  orderId: string,
  invoiceNumber: string,
  updatedBy: string,
): Promise<MarkOrderInvoicedResult> {
  const url = requireEnv('APPSCRIPT_GATEWAY_URL')
  const request: OrderFormGatewayUpdateRequest = {
    resource: 'sheet',
    action: 'UPDATE',
    target: 'OrderForm',
    key_value: orderId,
    data: {
      invoice_id: invoiceNumber,
      updated_by: updatedBy,
    },
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      // Apps Script rejects the JSON preflight; text/plain avoids it while
      // the body is still a JSON string Apps Script reads via
      // e.postData.contents. Matches invoice.gateway-client.ts's transport.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    // Network failure / timeout: no answer at all came back.
    return {
      outcome: 'unknown',
      message: `Gateway request failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  if (!response.ok) {
    return { outcome: 'unknown', message: `Gateway HTTP ${response.status} ${response.statusText}` }
  }

  let body: OrderFormGatewayResponse
  try {
    body = (await response.json()) as OrderFormGatewayResponse
  } catch {
    return { outcome: 'unknown', message: 'Gateway response was not valid JSON' }
  }

  if (body.status === 'ok') {
    return { outcome: 'confirmed' }
  }
  // A well-formed { status: 'error' } body: the gateway gave a definite answer.
  return { outcome: 'not_sent', message: body.message }
}
