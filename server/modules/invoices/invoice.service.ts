import { randomUUID } from 'node:crypto'
import type { z } from 'zod'
import {
  invoiceCreateSchema,
  type CreateInvoiceResponse,
  type InvoiceAdjustmentInput,
} from '../../../contracts/invoices/invoice-api.schema.js'
import { invoiceViewApiContract } from '../../../contracts/invoices/invoice-view-api.schema.js'
import {
  computeInvoiceLine,
  computeInvoiceTotal,
  roundMoney,
} from '../../../contracts/invoices/invoice-calculator.js'
import { getInvoicesRepository } from '../../sheets/Invoices/Invoices.repository.js'
import { invoicesRowSchema } from '../../sheets/Invoices/Invoices.db-contract.js'
import { getInvoiceItemsRepository } from '../../sheets/InvoiceItems/InvoiceItems.repository.js'
import { invoiceItemsRowSchema } from '../../sheets/InvoiceItems/InvoiceItems.db-contract.js'
import { getInvoicesViewRepository } from '../../sheets/InvoicesView/InvoicesView.repository.js'
import { invoicesViewRowSchema } from '../../sheets/InvoicesView/InvoicesView.db-contract.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import { orderFormRowSchema } from '../../sheets/OrderForm/OrderForm.db-contract.js'
import { syncInvoiceView as defaultSyncInvoiceView } from './invoice-view-sync-client.js'
import type { InvoiceViewSyncResult } from './invoice-view-sync-client.js'
import {
  WriteCommittedUnreadableError,
  WriteRejectedError,
  WriteTransportError,
} from '../../shared/repositories/sheets-api.client.js'
import { DuplicateRowKeyError } from '../../shared/repositories/sheet-row-lookup.js'
import { WriteRowIdentityMismatchError } from '../../shared/repositories/sheet-row-identity.js'
import {
  BaseCrudService,
  mapDbRowToApi,
  type JsonColumnMap,
  type ServiceListResult,
} from '../../shared/services/base-crud.service.js'
import { Mapper, type ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import type { ApiQueryParams } from '../../shared/http/api-handler.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'

/** Fallback actor recorded in `created_by` when no staff identity is supplied. */
export const INVOICE_CREATED_BY = 'staff'

type InvoicesDbRow = z.infer<typeof invoicesRowSchema>
type InvoiceItemsDbRow = z.infer<typeof invoiceItemsRowSchema>
type OrderFormDbRow = z.infer<typeof orderFormRowSchema>

export const invoicesFieldMap = {
  invoice_number: 'invoiceNumber',
  status: 'status',
  billing_type: 'billingType',
  billing_period_start: 'billingPeriodStart',
  billing_period_end: 'billingPeriodEnd',
  issued_date: 'issuedDate',
  due_date: 'dueDate',
  customer_id: 'customerId',
  customer: 'customer',
  adjustments: 'adjustments',
  created_by: 'createdBy',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  deleted_at: 'deletedAt',
  deleted_by: 'deletedBy',
} as const satisfies Record<keyof InvoicesDbRow & string, string>

export const invoiceItemsFieldMap = {
  invoice_number: 'invoiceNumber',
  invoice_item_id: 'invoiceItemId',
  item_no: 'itemNo',
  source_order_id: 'sourceOrderId',
  source_item_id: 'sourceItemId',
  sku: 'sku',
  service_type: 'serviceType',
  description: 'description',
  quantity: 'quantity',
  unit: 'unit',
  unit_price: 'unitPrice',
  subtotal: 'subtotal',
  adjustments: 'adjustments',
  net_total: 'netTotal',
} as const satisfies Record<keyof InvoiceItemsDbRow & string, string>

export const orderFormFieldMap = {
  id: 'id',
  order_number: 'orderNumber',
  customer_id: 'customerId',
  received_date: 'receivedDate',
  due_date: 'dueDate',
  service_type: 'serviceType',
  status: 'status',
  quantity: 'quantity',
  hangers: 'hangers',
  bags: 'bags',
  hangers_image: 'hangersImage',
  bags_image: 'bagsImage',
  form_image: 'formImage',
  note: 'note',
  timestamp: 'timestamp',
  created_by: 'createdBy',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  invoice_id: 'invoiceId',
  order_name: 'orderName',
  order_description: 'orderDescription',
} as const satisfies Record<keyof OrderFormDbRow & string, string>

/** The one id scheme used across this codebase: the first 8 hex characters
 *  of `crypto.randomUUID()` (its first hyphen-delimited group, no stripping
 *  needed) — not a per-entity format. */
function defaultGenerateItemId(): string {
  return randomUUID().slice(0, 8)
}

/** Safe to drop `refSource`/`refCode` only when BOTH are absent — the API
 *  schema refines that one is never sent without the other. */
type InvoiceDbAdjustment = Omit<InvoiceAdjustmentInput, 'refSource' | 'refCode'> & {
  ref_source?: string
  ref_code?: string
}

function toDbAdjustment(adjustment: InvoiceAdjustmentInput): InvoiceDbAdjustment {
  return {
    label: adjustment.label,
    calculation: adjustment.calculation,
    value: adjustment.value,
    ...(adjustment.refSource !== undefined ? { ref_source: adjustment.refSource } : {}),
    ...(adjustment.refCode !== undefined ? { ref_code: adjustment.refCode } : {}),
  }
}

interface WriteFailure {
  certainty: 'rejected' | 'unknown'
  message: string
}

/**
 * Maps a write failure to the public certainty value.
 *
 * rejected  — WriteRejectedError, DuplicateRowKeyError:
 *             the write was refused before or by the sheet, nothing was stored.
 * unknown   — WriteTransportError:
 *             the transport outcome does not prove whether the row was stored.
 * unknown   — WriteCommittedUnreadableError, WriteRowIdentityMismatchError:
 *             the write completed, but its persisted result could not be safely
 *             read or identified. Neither group may be auto-retried.
 *
 * Any error that is not one of these typed classes is classified 'unknown',
 * never 'rejected' — over-claiming 'rejected' would invite a retry that
 * duplicates data. A new write error class must be added here explicitly; the
 * default is deliberately the cautious one, not the correct one.
 */
function classifyWriteFailure(error: unknown): WriteFailure {
  if (error instanceof WriteRejectedError || error instanceof DuplicateRowKeyError) {
    return { certainty: 'rejected', message: error.message }
  }
  if (error instanceof WriteCommittedUnreadableError) {
    return {
      certainty: 'unknown',
      message: `Write committed but the persisted row could not be read back; do not retry: ${error.message}`,
    }
  }
  if (error instanceof WriteTransportError || error instanceof WriteRowIdentityMismatchError) {
    return {
      certainty: 'unknown',
      message: `Write outcome unknown: ${error.message}`,
    }
  }
  return { certainty: 'unknown', message: error instanceof Error ? error.message : String(error) }
}

/** Minimal write-side ports `InvoiceService` depends on — real `SheetRepository`
 *  instances satisfy these structurally; tests inject fakes that record calls
 *  without needing to extend the repository or mock `fetch`. */
export interface InvoiceHeaderWriter {
  append(data: Partial<InvoicesDbRow>): Promise<unknown>
}
export interface InvoiceItemWriter {
  batchAppend(rows: Array<Partial<InvoiceItemsDbRow>>): Promise<unknown[]>
}
export interface OrderFormWriter {
  update(id: string, data: Partial<OrderFormDbRow>): Promise<unknown>
}
export type ViewSyncFn = (invoiceNumber: string) => Promise<InvoiceViewSyncResult>

type InvoicesViewDbRow = z.infer<typeof invoicesViewRowSchema>

/** DB column -> API/domain field. JSON columns retain their storage names
 * here; `invoicesViewJsonColumns` declares the decoded fields below. */
export const invoicesViewFieldMap = {
  invoiceNumber: 'invoiceNumber',
  status: 'status',
  billingType: 'billingType',
  billingPeriodStart: 'billingPeriodStart',
  billingPeriodEnd: 'billingPeriodEnd',
  issuedDate: 'issuedDate',
  dueDate: 'dueDate',
  customerId: 'customerId',
  customerJson: 'customerJson',
  itemsJson: 'itemsJson',
  adjustmentsJson: 'adjustmentsJson',
  paymentsJson: 'paymentsJson',
  subtotal: 'subtotal',
  adjustmentTotal: 'adjustmentTotal',
  grandTotal: 'grandTotal',
  paidAmount: 'paidAmount',
  balanceDue: 'balanceDue',
} as const satisfies Record<keyof InvoicesViewDbRow & string, string>

export const invoicesViewJsonColumns = {
  customerJson: { field: 'customer', kind: 'object' },
  itemsJson: { field: 'items', kind: 'array' },
  adjustmentsJson: { field: 'adjustments', kind: 'array' },
  paymentsJson: { field: 'payments', kind: 'array' },
} as const satisfies JsonColumnMap

const invoicesViewMapper = new Mapper(invoicesViewFieldMap)

function mapInvoicesViewRowToApi(
  row: Partial<Record<string, unknown>>,
): Record<string, unknown> {
  return mapDbRowToApi(row, invoicesViewMapper, invoicesViewJsonColumns)
}

type InvoiceViewApiRow = ApiRowFromFieldMap<InvoicesViewDbRow, typeof invoicesViewFieldMap>
type InvoiceViewListQuery = z.infer<typeof invoiceViewApiContract.query.list>
type InvoiceViewListResponse = z.infer<typeof invoiceViewApiContract.response.list>
type InvoiceViewDetailResponse = z.infer<typeof invoiceViewApiContract.response.detail>

/** Read-only injection seam. The production getter returns DB-shaped rows;
 * adapters may inject a reader whose rows are already API-shaped. The shared
 * mapper accepts either representation; the production path is DB-mapped. */
export interface InvoiceViewReader {
  read(query?: unknown): Promise<Array<Partial<Record<string, unknown>>>>
}

type InvoicesViewRepository = SheetRepositoryContract<InvoicesViewDbRow>

function adaptInvoiceViewReader(reader: InvoiceViewReader): InvoicesViewRepository {
  const unsupported = (): never => {
    throw new Error('InvoicesView is read-only')
  }

  return {
    read: async (query) =>
      (await reader.read(query)) as Array<Partial<InvoicesViewDbRow>>,
    append: async () => unsupported(),
    batchAppend: async () => unsupported(),
    update: async () => unsupported(),
    delete: async () => unsupported(),
  }
}

export interface InvoiceServiceOptions {
  invoiceRepository?: () => InvoiceHeaderWriter
  invoiceItemRepository?: () => InvoiceItemWriter
  orderFormRepository?: () => OrderFormWriter
  invoiceViewRepository?: InvoiceViewReader
  syncInvoiceView?: ViewSyncFn
  generateItemId?: () => string
  createdBy?: string
}

/**
 * Owns the whole multi-sheet Invoice create workflow plus Invoice list/detail
 * reads. Validates the public request once
 * at the boundary, computes every line's `subtotal`/`net_total` server-side
 * (authoritative — the client's own live preview is never trusted), writes
 * the `InvoiceItem` batch FIRST (exactly ONE `batchAppend()`), then the
 * `Invoice` header row, then marks the source `OrderForm` row as invoiced,
 * syncs the materialized `InvoicesView` as the final external write, and
 * returns one of six distinct outcomes. Never throws for an expected outcome
 * (bad input, a rejected item batch, a failed header write, a failed
 * order-link write, or a failed view sync) — those are all represented in the
 * return value per `contracts/invoices/invoice-api.schema.ts`. Only a genuine
 * programmer error is expected to escape as a thrown error.
 */
export class InvoiceService {
  // Write-side repositories are lazy. GET /api/invoices only needs the
  // materialized InvoicesView repository; constructing these here would make
  // a read request depend on INVOICES_SPREADSHEET_ID and the write gateway
  // configuration even though it never writes to those sheets.
  private readonly invoiceRepository: () => InvoiceHeaderWriter
  private readonly invoiceItemRepository: () => InvoiceItemWriter
  private readonly orderFormRepository: () => OrderFormWriter
  private readonly invoiceViewRepository: () => InvoicesViewRepository
  private readonly syncInvoiceView: ViewSyncFn
  private readonly generateItemId: () => string
  private readonly createdBy: string
  private readonly readService: BaseCrudService<
    InvoiceViewApiRow,
    InvoiceViewListQuery,
    never,
    never,
    InvoiceViewListResponse,
    InvoiceViewDetailResponse,
    never,
    never,
    InvoicesViewDbRow,
    typeof invoicesViewFieldMap
  >

  constructor(options: InvoiceServiceOptions = {}) {
    this.invoiceRepository = options.invoiceRepository ?? getInvoicesRepository

    this.invoiceItemRepository = options.invoiceItemRepository ?? getInvoiceItemsRepository

    this.orderFormRepository = options.orderFormRepository ?? getOrderFormRepository

    let invoiceViewRepository = options.invoiceViewRepository
    this.invoiceViewRepository = () =>
      invoiceViewRepository === undefined
        ? getInvoicesViewRepository()
        : adaptInvoiceViewReader(invoiceViewRepository)
    this.syncInvoiceView = options.syncInvoiceView ?? defaultSyncInvoiceView
    this.generateItemId = options.generateItemId ?? defaultGenerateItemId
    this.createdBy = options.createdBy ?? INVOICE_CREATED_BY

    this.readService = new BaseCrudService<
      InvoiceViewApiRow,
      InvoiceViewListQuery,
      never,
      never,
      InvoiceViewListResponse,
      InvoiceViewDetailResponse,
      never,
      never,
      InvoicesViewDbRow,
      typeof invoicesViewFieldMap
    >({
      // invoiceNumber/customerId are the only flat, searchable columns — the
      // rest of the row (customer, items, adjustments, payments) is
      // serialized JSON.
      repository: this.invoiceViewRepository,
      api: invoiceViewApiContract,
      searchFields: ['invoiceNumber', 'customerId'],
      fieldMap: invoicesViewFieldMap,
      jsonColumns: invoicesViewJsonColumns,
    })
  }

  async create(payload: unknown): Promise<CreateInvoiceResponse> {
    const parsed = invoiceCreateSchema.safeParse(payload)
    if (!parsed.success) {
      return {
        kind: 'validation_error',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.') || '(root)',
          message: issue.message,
        })),
      }
    }

    const request = parsed.data

    // ── Compute every line server-side; nothing the browser sent for
    //    subtotal/netTotal is read anywhere in this function. ──
    const lineCalculations = request.items.map((item) =>
      computeInvoiceLine({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        adjustments: item.adjustments,
      }),
    )

    const itemCommands: Array<Partial<InvoiceItemsDbRow>> = request.items.map((item, index) => ({
      invoice_number: request.invoiceNumber,
      invoice_item_id: this.generateItemId(),
      item_no: index + 1, // 1-based, derived from array position — never client-sent
      // The invoice's single sourceOrderId, fanned out onto every row —
      // there is no per-line sourceOrderId in this request.
      source_order_id: request.sourceOrderId,
      // Always null — no per-item traceability, only
      // per-order via sourceOrderId above.
      source_item_id: null,
      service_type: null,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit ?? null,
      unit_price: item.unitPrice,
      subtotal: lineCalculations[index].subtotal,
      // InvoiceItems.adjustments is a text cell; serialize it before the row
      // reaches the sheet repository.
      adjustments: JSON.stringify(item.adjustments.map(toDbAdjustment)),
      net_total: lineCalculations[index].netTotal,
    }))

    // ── Items first, as ONE batch — never a loop. This ordering is
    //    load-bearing because a later header failure leaves these rows behind. ──
    try {
      await this.invoiceItemRepository().batchAppend(itemCommands)
    } catch (error) {
      const failure = classifyWriteFailure(error)
      console.error('items_write_failed', error instanceof Error ? error.stack ?? error.message : String(error))
      return { kind: 'items_write_failed', message: failure.message, certainty: failure.certainty }
    }

    const customerSnapshot = {
      customer_code: request.customer.customerCode,
      customer_name: request.customer.customerName,
      ...(request.customer.phone !== undefined ? { phone: request.customer.phone } : {}),
      ...(request.customer.address !== undefined ? { address: request.customer.address } : {}),
    }
    const invoiceCommand: Partial<InvoicesDbRow> = {
      invoice_number: request.invoiceNumber,
      status: 'ISSUED',
      billing_type: 'ORDER',
      issued_date: request.issuedDate,
      due_date: request.dueDate,
      // Denormalized so GViz can filter without reaching into the JSON
      // snapshot — must equal customer.customer_code exactly.
      customer_id: request.customer.customerCode,
      // Invoices.customer and Invoices.adjustments are text cells; serialize
      // them before the row reaches the sheet repository.
      customer: JSON.stringify(customerSnapshot),
      adjustments: JSON.stringify(request.adjustments.map(toDbAdjustment)),
      created_by: this.createdBy,
    }

    try {
      await this.invoiceRepository().append(invoiceCommand)
    } catch (error) {
      // ⚠ Worst-case outcome: the item batch above already succeeded, so
      // itemCommands.length rows now exist referencing an invoice_number
      // with no header row. Reported as its own distinct kind — never
      // collapsed into items_write_failed — because a person now has to
      // reconcile this by hand, and a plain retry would append a second set
      // of items, regardless of `certainty`. This outcome carries no
      // `message` field in the public contract — only `certainty`.
      const failure = classifyWriteFailure(error)
      console.error('invoice_write_failed', error instanceof Error ? error.stack ?? error.message : String(error))
      return {
        kind: 'invoice_write_failed',
        invoiceNumber: request.invoiceNumber,
        itemCount: itemCommands.length,
        certainty: failure.certainty,
      }
    }

    // ── Mark the source order as invoiced. The invoice IS fully and
    //    correctly recorded at this point (items + header both written) —
    //    only the OrderForm-side linkage is missing if this step fails.
    //    Reported as its own distinct kind, never folded into
    //    invoice_write_failed, so the caller never offers a retry here: a
    //    retry would create a SECOND invoice for money that's already
    //    correctly billed. ──
    try {
      await this.orderFormRepository().update(request.sourceOrderId, {
        invoice_id: request.invoiceNumber,
        updated_by: this.createdBy,
      })
    } catch (error) {
      const failure = classifyWriteFailure(error)
      console.error('order_link_failed', error instanceof Error ? error.stack ?? error.message : String(error))
      return {
        kind: 'order_link_failed',
        invoiceNumber: request.invoiceNumber,
        sourceOrderId: request.sourceOrderId,
        certainty: failure.certainty,
      }
    }

    // Line netTotals are already rounded money, but summing several 2-decimal
    // floats can itself reintroduce binary drift — round the sum once, same
    // as computeInvoiceTotal does for its linesTotal.
    const itemsTotal = roundMoney(
      lineCalculations.reduce((sum, calculation) => sum + calculation.netTotal, 0),
    )
    const invoiceTotal = computeInvoiceTotal(
      lineCalculations.map((calculation) => calculation.netTotal),
      request.adjustments,
    )

    // This MUST remain the final external write. The source invoice and
    // order link are complete before refreshing the materialized view used
    // by the UI.
    //
    // `this.syncInvoiceView` is injectable (`InvoiceServiceOptions`), and the
    // real `syncInvoiceView` (invoice-view-sync-client.ts) is written to
    // never throw — but this is the one stage whose implementation this
    // service does not fully control, unlike the three write-side ports
    // above. Left unwrapped, a thrown error here would propagate past this
    // method entirely: `invoice.module.ts`'s route returns
    // `CreateInvoiceResponse` directly (not the generic `{success,data,meta}`
    // envelope), but a thrown error is caught by `ApiHandler`'s GENERIC
    // catch, which DOES return that generic envelope — a body with no
    // `kind` at all. The frontend's `result.kind` checks would then all
    // miss, rendering a blank result panel after a fully successful,
    // already-committed invoice. Wrapping this call closes that gap at the
    // source (the frontend also hardens against it independently — see
    // `invoice.service.ts` (frontend) and `synthesizeNetworkFailureOutcome`).
    let viewSync: Awaited<ReturnType<ViewSyncFn>>
    try {
      viewSync = await this.syncInvoiceView(request.invoiceNumber)
    } catch (error) {
      viewSync = {
        outcome: 'failed',
        certainty: 'unknown',
        message: error instanceof Error ? error.message : String(error),
      }
    }
    if (viewSync.outcome !== 'confirmed') {
      return {
        kind: 'invoice_view_sync_failed',
        invoiceNumber: request.invoiceNumber,
        message: viewSync.message,
        certainty: viewSync.certainty,
      }
    }

    return {
      kind: 'created',
      invoiceNumber: request.invoiceNumber,
      itemCount: itemCommands.length,
      itemsTotal,
      invoiceTotal,
    }
  }

  /**
   * List invoices. `dateFrom`/`dateTo` are a range filter against
   * `issuedDate`, not a literal equality column — see `listWithDateRange`'s
   * doc comment for why that one query shape bypasses the generic
   * `BaseCrudService.list()` path.
   */
  async list(query: ApiQueryParams): Promise<ServiceListResult<InvoiceViewListResponse>> {
    if (this.hasDateRangeFilter(query)) {
      return this.listWithDateRange(query)
    }
    return this.readService.list(query)
  }

  async getById(id: string): Promise<InvoiceViewDetailResponse> {
    return this.readService.getById(id)
  }

  private hasDateRangeFilter(query: ApiQueryParams): boolean {
    return query.dateFrom !== undefined || query.dateTo !== undefined
  }

  /**
   * `dateFrom`/`dateTo` are range filters, not equality columns, so they are
   * stripped out of the where clause; every other filter (customerId, status,
   * keyword, sort) still goes through the repository/GViz. The `pagination`
   * field on `ReadQueryDTO` is intentionally left unset so this fetches every
   * row matching the OTHER filters (no sheet-side `limit`/`offset`). Date
   * filtering then happens in JS (`issuedDate` is an ISO `YYYY-MM-DD` string;
   * `<=`/`>=` compares correctly with no `Date` parsing) against that FULL
   * result set, and pagination is applied last, over the filtered set — never
   * before it, or a later page could look emptier than it really is while
   * matches sit on an earlier page's cut.
   */
  private async listWithDateRange(
    query: ApiQueryParams,
  ): Promise<ServiceListResult<InvoiceViewListResponse>> {
    const validQuery = parseOrThrow(invoiceViewApiContract.query.list, query)

    // dateFrom/dateTo are intentionally omitted from the DB query: they are
    // range semantics applied below in JavaScript, not physical columns.
    // Only customerId/status become real equality clauses, same as the
    // generic path would build.
    const where = invoicesViewMapper.toDb({
      customerId: validQuery.customerId,
      status: validQuery.status,
    }) as Partial<InvoicesViewDbRow>

    const dto = new ReadQueryDTO<Partial<InvoicesViewDbRow>>({
      where,
      search: {
        keyword: validQuery.keyword,
        fields: ['invoiceNumber', 'customerId'].map((field) =>
          invoicesViewMapper.toDbField(field),
        ),
      },
      sort: {
        field: invoicesViewMapper.toDbField(validQuery.sortBy),
        order: validQuery.sortOrder,
      },
      // pagination intentionally omitted — see the doc comment above.
    })

    const rows = (await this.invoiceViewRepository().read(dto)).map(mapInvoicesViewRowToApi)

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
      items: pageRows.map((row) => this.projectListRow(row as Record<string, unknown>)),
      pagination: { page: validQuery.page, perPage: validQuery.perPage },
    }
  }

  /** Projects only fields declared by the invoice-view list response. */
  private projectListRow(
    row: Record<string, unknown>,
  ): InvoiceViewListResponse {
    const output: Record<string, unknown> = {}
    for (const field of Object.keys(invoiceViewApiContract.response.list.shape)) {
      output[field] = row[field]
    }
    return output as InvoiceViewListResponse
  }
}
