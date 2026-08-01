import type { z } from 'zod'
import type { CreateInvoiceResponse } from '../../../contracts/invoices/invoice-api.schema.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import type { ApiHandlerRequest } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { ok, okPaged, type ApiResult } from '../../shared/http/response.js'
import { createInvoice } from './invoice.service.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { getInvoiceViewRepository } from './invoice-view.repository.js'
import { invoiceViewContract } from './invoice-view.contract.js'
import { ReadQueryDTO, type OmitReservedQueryFields } from '../../shared/dtos/read-query.dto.js'
import { parseOrThrow } from '../../shared/http/validate.js'

/** Read-where shape for `listInvoicesWithDateRange` — the same
 *  `OmitReservedQueryFields<listQuery>` shape `ReadQueryDTO.fromQuery()`
 *  derives generically, restated here because this function builds its
 *  `where` by hand instead of going through `fromQuery()`. */
type InvoiceReadWhere = OmitReservedQueryFields<
  z.infer<typeof invoiceViewContract.api.query.list>
>

/**
 * Hand-rolled routes — not `createCrudRoutes()`, because POST writes two
 * sheets through a non-standard six-outcome gateway envelope that the
 * generic factory can't express. GET (list + by-id) is served by a small
 * BaseCrudService built HERE from `getInvoiceViewRepository()` +
 * `invoiceViewContract.api`, imported directly from invoice-view.repository.ts
 * / invoice-view.contract.ts, per this repo's rule against one module
 * importing another module's `.module.ts` (api/CLAUDE.md) — that would drag
 * in a second, unwanted `BaseCrudService`/routes construction as an ESM side
 * effect. There is no standalone invoice-view module file; this is the only
 * place the read side is wired up.
 *
 * The POST response body IS the `CreateInvoiceResponse` discriminated union
 * from `contracts/invoices/invoice-api.schema.ts`, returned directly — not
 * wrapped in the generic `{ success, data, meta }` envelope `ok`/`okPaged`
 * build. GET, in contrast, DOES use the generic envelope via `ok`/`okPaged`,
 * same as every other read endpoint in the app.
 */

const invoiceReadService = new BaseCrudService({
  repository: getInvoiceViewRepository(),
  api: invoiceViewContract.api,
  // invoiceNumber/customerId are the only flat, searchable columns — the
  // rest of the row (customer, items, adjustments, payments) is serialized
  // JSON.
  searchFields: ['invoiceNumber', 'customerId'],
})

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

/**
 * `dateFrom`/`dateTo` are a range filter against `issuedDate`, not a literal
 * equality column. `BaseCrudService.list()` -> `ReadQueryDTO.fromQuery()`
 * folds every non-reserved list-query field into a `where[field] = value`
 * equality clause (api/CLAUDE.md's Key Engine Rules), and
 * `GVizQueryBuilder.where()`/`resolveColumn()` has no concept of a range
 * operator — it throws `No GViz column resolves for field 'dateFrom'`
 * because `dateFrom` was never meant to resolve to a real column at all.
 *
 * No other module (appointments/orders/customers) has an existing date-range
 * list filter to follow, so this is a smallest-possible, invoices-local fix:
 * bypass `invoiceReadService.list()` for this one query shape and hand-roll
 * the read here. `dateFrom`/`dateTo` are stripped out of the where clause;
 * every other filter (customerId, status, keyword, sort) still goes through
 * the repository/GViz exactly as `ReadQueryDTO` would build it. The
 * `pagination` field on `ReadQueryDTO` is intentionally left unset —
 * `GVizQueryBuilder.pagination()` no-ops without it, so this fetches every
 * row matching the OTHER filters (no sheet-side `limit`/`offset`). Date
 * filtering then happens in JS (`issuedDate` is an ISO `YYYY-MM-DD` string;
 * `<=`/`>=` compares correctly with no `Date` parsing, per this repo's own
 * documented gotcha) against that FULL result set, and pagination is applied
 * last, over the filtered set — never before it, or a later page could look
 * emptier than it really is while matches sit on an earlier page's cut.
 */
async function listInvoicesWithDateRange(query: unknown) {
  const validQuery = parseOrThrow(invoiceViewContract.api.query.list, query)

  // dateFrom/dateTo are forced to null here (rather than omitted) so `where`
  // still satisfies the repository's read-where type; GVizQueryBuilder.where()
  // treats null as an "ignored value" and skips it, so no column ever needs
  // to resolve for them — only customerId/status become real equality
  // clauses, same as the generic path would build.
  const where: InvoiceReadWhere = {
    customerId: validQuery.customerId,
    status: validQuery.status,
    dateFrom: null,
    dateTo: null,
  }

  const dto = new ReadQueryDTO<InvoiceReadWhere>({
    where,
    search: { keyword: validQuery.keyword, fields: ['invoiceNumber', 'customerId'] },
    sort: { field: validQuery.sortBy, order: validQuery.sortOrder },
    // pagination intentionally omitted — see function doc comment above.
  })

  const rows = await getInvoiceViewRepository().read(dto)

  const filtered = rows.filter((row) => {
    const issuedDate = (row as Record<string, unknown>).issuedDate
    if (typeof issuedDate !== 'string') return false
    if (validQuery.dateFrom && issuedDate < validQuery.dateFrom) return false
    if (validQuery.dateTo && issuedDate > validQuery.dateTo) return false
    return true
  })

  const start = (validQuery.page - 1) * validQuery.perPage
  const pageRows = filtered.slice(start, start + validQuery.perPage)

  return {
    items: pageRows.map(projectListRow),
    pagination: { page: validQuery.page, perPage: validQuery.perPage },
  }
}

/**
 * Mirrors `BaseCrudService`'s private `project()` — copies only the fields
 * `invoiceViewContract.api.response.list` declares, so this hand-rolled path
 * returns the exact same shape the generic path's projection would.
 */
function projectListRow(row: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const field of Object.keys(invoiceViewContract.api.response.list.shape)) {
    output[field] = row[field]
  }
  return output
}

function hasDateRangeFilter(query: ApiHandlerRequest['query']): boolean {
  return query.dateFrom !== undefined || query.dateTo !== undefined
}

export const invoiceRoutes: GatewayModuleRoutes = {
  collection: new ApiHandler({
    GET: async (req) => {
      const { items, pagination } = hasDateRangeFilter(req.query)
        ? await listInvoicesWithDateRange(req.query)
        : await invoiceReadService.list(req.query)
      return okPaged(items, pagination)
    },
    POST: async (req): Promise<ApiResult<CreateInvoiceResponse>> => {
      const response = await createInvoice(req.body)
      return { status: statusForResponse(response), body: response }
    },
  }),
  item: new ApiHandler({
    GET: async (req) => ok(await invoiceReadService.getById(req.params.id)),
  }),
}
