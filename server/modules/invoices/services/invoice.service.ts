// ⚠ MOVED AS-IS from api/modules/invoices — pending full invoice-module refactor.
//   The move only relocated files (relative imports to ../../../shared were
//   preserved); treat this layout as temporary, pending the full invoice refactor.
import { z } from 'zod'
import { ApiError } from '../../../shared/http/api-error'
import { parseOrThrow } from '../../../shared/http/validate'
import { apiPaginationMetaSchema } from '../../../../contracts/shared/api.schema'
import type { ApiQueryParams } from '../../../shared/types/handler.types'
import { generateId } from '../../../shared/utils/id'
import {
  toCreateRecord,
  toDetailDto,
  toListItemDto,
  toPaymentCreateRow,
  toPaymentUpdateRow,
  toSummaryUpdate,
} from '../mappers/invoice.mapper'
import { invoiceRepository } from '../repositories/invoice.repository'
import {
  invoiceCreateSchema,
  invoiceListQuerySchema,
  paymentCreateSchema,
  paymentUpdateSchema,
} from '../types/invoice.schema'
import type { InvoiceDetailDto, InvoiceListItemDto } from '../types/invoice-response.types'
import type { PaymentRow, PaymentSummaryRow } from '../types/invoice-sheet.types'

const ID_LENGTH = 8

export interface InvoiceListResult {
  items: InvoiceListItemDto[]
  pagination: z.infer<typeof apiPaginationMetaSchema>
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function now(): string {
  return new Date().toISOString()
}

// INV-YYYYMM-<random4>, derived from the issued date. No running counter, so two
// concurrent creates can't race on a shared max (the random suffix keeps it unique).
function generateInvoiceNumber(issuedDate: string): string {
  const yyyymm = issuedDate.slice(0, 7).replace('-', '')
  return `INV-${yyyymm}-${generateId(4)}`
}

export const invoiceService = {
  async listInvoices(query: ApiQueryParams): Promise<InvoiceListResult> {
    const filter = parseOrThrow(invoiceListQuerySchema, query)
    const records = await invoiceRepository.getByFilter(filter)
    const day = today()

    // Map first (resolves the display status, incl. derived OVERDUE), then apply the
    // status filter the Invoices sheet can't express. Pagination follows the filter,
    // so `total` reflects the filtered result.
    let items = records.map((record) => toListItemDto(record, day))
    if (filter.status) {
      items = items.filter((item) => item.status === filter.status)
    }

    const total = items.length
    const start = (filter.page - 1) * filter.perPage
    const pageItems = items.slice(start, start + filter.perPage)

    return {
      items: pageItems,
      pagination: {
        total,
        page: filter.page,
        perPage: filter.perPage,
        totalPages: Math.ceil(total / filter.perPage),
      },
    }
  },

  async getInvoice(invoiceId: string): Promise<InvoiceDetailDto> {
    const record = await invoiceRepository.getById(invoiceId)
    if (!record) {
      throw ApiError.notFound(`Invoice '${invoiceId}' not found`)
    }
    return toDetailDto(record, today())
  },

  async createInvoice(rawInput: unknown): Promise<InvoiceDetailDto> {
    const input = parseOrThrow(invoiceCreateSchema, rawInput)

    const createdAt = now()
    const issuedDate = input.issuedDate ?? today()
    const invoiceId = generateId(ID_LENGTH)

    const record = toCreateRecord(input, {
      invoiceId,
      invoiceNumber: generateInvoiceNumber(issuedDate),
      issuedDate,
      createdAt,
      itemIds: input.items.map(() => generateId(ID_LENGTH)),
      paymentSummaryId: generateId(ID_LENGTH),
    })

    await invoiceRepository.create(record)

    // We just built every row — assemble the response without a re-read.
    return toDetailDto(
      {
        invoice: record.invoice,
        items: record.items,
        paymentSummary: record.paymentSummary,
        payments: [],
      },
      today(),
    )
  },

  async recordPayment(invoiceId: string, rawInput: unknown): Promise<InvoiceDetailDto> {
    const input = parseOrThrow(paymentCreateSchema, rawInput)
    const record = await requireRecord(invoiceId)
    const summaryRow = requireSummary(record.paymentSummary, invoiceId)

    const timestamp = now()
    const payment = toPaymentCreateRow(invoiceId, input, {
      paymentId: generateId(ID_LENGTH),
      createdAt: timestamp,
    })

    // New payments start PENDING, so the rollup is unchanged numerically — but we
    // recompute over the full set to keep it authoritative regardless.
    const effectivePayments: PaymentRow[] = [...record.payments, payment]
    const summary = toSummaryUpdate(summaryRow, effectivePayments, {
      updatedAt: timestamp,
      updatedBy: input.createdBy,
    })

    await invoiceRepository.recordPayment({ payment, summary })

    return toDetailDto(
      {
        invoice: record.invoice,
        items: record.items,
        paymentSummary: { ...summaryRow, ...summary },
        payments: effectivePayments,
      },
      today(),
    )
  },

  async updatePayment(
    invoiceId: string,
    paymentId: string,
    rawInput: unknown,
  ): Promise<InvoiceDetailDto> {
    const input = parseOrThrow(paymentUpdateSchema, rawInput)
    const record = await requireRecord(invoiceId)
    const summaryRow = requireSummary(record.paymentSummary, invoiceId)

    const existing = record.payments.find((payment) => payment.id === paymentId)
    if (!existing) {
      throw ApiError.notFound(`Payment '${paymentId}' not found on invoice '${invoiceId}'`)
    }

    const timestamp = now()
    const patch = toPaymentUpdateRow(paymentId, input, timestamp)

    // Apply the patch in memory so the rollup reflects the new effective set
    // (e.g. a payment flipping to VERIFIED now counts toward amount_paid).
    const updated: PaymentRow = { ...existing, ...patch }
    const effectivePayments = record.payments.map((payment) =>
      payment.id === paymentId ? updated : payment,
    )
    const summary = toSummaryUpdate(summaryRow, effectivePayments, {
      updatedAt: timestamp,
      updatedBy: input.updatedBy,
    })

    await invoiceRepository.updatePayment({ payment: patch, summary })

    return toDetailDto(
      {
        invoice: record.invoice,
        items: record.items,
        paymentSummary: { ...summaryRow, ...summary },
        payments: effectivePayments,
      },
      today(),
    )
  },
}

async function requireRecord(invoiceId: string) {
  const record = await invoiceRepository.getById(invoiceId)
  if (!record) {
    throw ApiError.notFound(`Invoice '${invoiceId}' not found`)
  }
  return record
}

// A non-deleted invoice always has a seeded rollup; a missing one is a data fault.
function requireSummary(summary: PaymentSummaryRow | null, invoiceId: string): PaymentSummaryRow {
  if (!summary) {
    throw ApiError.internal(`Invoice '${invoiceId}' has no payment summary`)
  }
  return summary
}
