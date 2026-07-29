import type { CreateInvoiceResponse } from '../../../contracts/invoices/invoice-api.schema.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import type { ApiResult } from '../../shared/http/response.js'
import { createInvoice } from './invoice.service.js'

/**
 * Hand-rolled routes — not `createCrudRoutes()`. There is no `BaseCrudService`
 * backing this module: it writes two sheets through a non-standard gateway
 * envelope and has no read/update/delete capability at all in this pass
 * (create only). Collection route only; no item route exists, since there is
 * no GET-by-id or PATCH for an invoice.
 *
 * The response body IS the `CreateInvoiceResponse` discriminated union from
 * `contracts/invoices/invoice-api.schema.ts`, returned directly — not wrapped
 * in the generic `{ success, data, meta }` envelope that `ok`/`created`/
 * `errorBody` build. That envelope assumes one success shape and one error
 * shape; this endpoint's whole point is a five-outcome contract a client
 * reads via `body.kind`, so it is the top-level response as agreed in
 * `docs/contracts/invoice-api.contract.ts`, not nested under `data`.
 */

function statusForResponse(response: CreateInvoiceResponse): number {
  switch (response.kind) {
    case 'created':
      return 201
    case 'validation_error':
      return 422
    case 'items_write_failed':
      // Nothing was written — Apps Script rejected the whole batch. Still a
      // failed request, but a safe one to retry as-is.
      return 502
    case 'invoice_write_failed':
      // Items ARE written; only the header row failed. A server-side
      // inconsistency that needs a person to reconcile, not a plain upstream
      // failure — distinct status from items_write_failed on purpose.
      return 500
    case 'order_link_failed':
      // Items AND the invoice header are both written; only the OrderForm
      // linkage failed. Also a server-side inconsistency needing a person to
      // reconcile — 500, like invoice_write_failed — but a DIFFERENT kind on
      // purpose: the client must never treat this as retryable, and folding
      // it into invoice_write_failed would risk exactly that.
      return 500
  }
}

export const invoiceRoutes: GatewayModuleRoutes = {
  collection: new ApiHandler({
    POST: async (req): Promise<ApiResult<CreateInvoiceResponse>> => {
      const response = await createInvoice(req.body)
      return { status: statusForResponse(response), body: response }
    },
  }),
}
