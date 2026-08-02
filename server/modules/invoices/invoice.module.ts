import type { CreateInvoiceResponse } from '../../../contracts/invoices/invoice-api.schema.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { ok, okPaged, type ApiResult } from '../../shared/http/response.js'
import { InvoiceService } from './invoice.service.js'

/**
 * Wiring + HTTP translation only — every business rule (validation,
 * calculation, write sequencing, list/detail/date-range querying) now lives
 * in `InvoiceService` (`invoice.service.ts`), per
 * `docs/invoice-module-refactor-plan.md`.
 *
 * Hand-rolled routes — not `createCrudRoutes()` — because POST writes
 * multiple sheets through a non-standard six-outcome union the generic
 * factory can't express, and GET needs the date-range bypass
 * `InvoiceService.list()` already encapsulates.
 *
 * The POST response body IS the `CreateInvoiceResponse` discriminated union
 * from `contracts/invoices/invoice-api.schema.ts`, returned directly — not
 * wrapped in the generic `{ success, data, meta }` envelope `ok`/`okPaged`
 * build. GET, in contrast, DOES use the generic envelope, same as every
 * other read endpoint in the app.
 */

export const invoiceService = new InvoiceService()

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
    case 'invoice_view_sync_failed':
      // The source invoice and order link are complete; only the materialized
      // read view failed to refresh.
      return 502
  }
}

export const invoiceRoutes: GatewayModuleRoutes = {
  collection: new ApiHandler({
    GET: async (req) => {
      const { items, pagination } = await invoiceService.list(req.query)
      return okPaged(items, pagination)
    },
    POST: async (req): Promise<ApiResult<CreateInvoiceResponse>> => {
      const response = await invoiceService.create(req.body)
      return { status: statusForResponse(response), body: response }
    },
  }),
  item: new ApiHandler({
    GET: async (req) => ok(await invoiceService.getById(req.params.id)),
  }),
}
