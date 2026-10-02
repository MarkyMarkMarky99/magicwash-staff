import { z } from 'zod'
import { paymentApiContract } from '../../../contracts/payments/payment-api.schema.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { FALLBACK_ACTOR } from '../../shared/config/actor.js'
import type { ApiRowFromFieldMap, RepositoryTransformer } from '../../shared/repositories/base.repository.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { Mapper } from '../../shared/repositories/base.repository.js'
import { BaseCrudService, mapDbRowToApi } from '../../shared/services/base-crud.service.js'
import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'
import { generateShortId } from '../../shared/utils/id.js'
import { paymentsRowSchema } from '../../sheets/Payments/Payments.db-contract.js'
import { getPaymentsRepository } from '../../sheets/Payments/Payments.repository.js'

type PaymentsDbRow = z.infer<typeof paymentsRowSchema>

export const paymentFieldMap = {
  payment_id: 'paymentId',
  invoice_number: 'invoiceNumber',
  amount: 'amount',
  method: 'method',
  status: 'status',
  paid_at: 'paidAt',
  reference: 'reference',
  proof_url: 'proofUrl',
  slip_data: 'slipData',
  notes: 'notes',
  created_at: 'createdAt',
  created_by: 'createdBy',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  deleted_at: 'deletedAt',
  deleted_by: 'deletedBy',
} as const satisfies Record<keyof PaymentsDbRow & string, string>

type PaymentApiRow = ApiRowFromFieldMap<PaymentsDbRow, typeof paymentFieldMap>
type PaymentListQuery = z.infer<typeof paymentApiContract.query.list>
type PaymentCreate = z.infer<typeof paymentApiContract.request.create>
type PaymentResponse = z.infer<typeof paymentApiContract.response.create>
type PaymentReview = z.infer<typeof paymentApiContract.request.update>
type PaymentReviewResponse = z.infer<typeof paymentApiContract.response.update>

const NOTE_SEPARATOR = ' | '

function blankTextToNull(response: unknown): unknown {
  if (response === null || typeof response !== 'object' || Array.isArray(response)) return response
  const row = { ...response } as Record<string, unknown>
  for (const column of ['reference', 'proof_url', 'notes', 'paid_at']) {
    if (row[column] === '') row[column] = null
  }
  return row
}

const transformer: RepositoryTransformer = { response: blankTextToNull }

// Keep the existing note (e.g. a slip-verifier code) and append the staff note after it.
function appendNote(existing: unknown, note: string | null): string | undefined {
  if (note === null) return undefined
  const current = typeof existing === 'string' ? existing.trim() : ''
  return current ? `${current}${NOTE_SEPARATOR}${note}` : note
}

export interface PaymentServiceOptions {
  repository?: SheetRepositoryContract<PaymentsDbRow>
  now?: () => Date
  generateId?: () => string
}

export class PaymentService extends BaseCrudService<
  PaymentApiRow, PaymentListQuery, PaymentCreate, PaymentReview,
  PaymentResponse, never, PaymentResponse, PaymentReviewResponse,
  PaymentsDbRow, typeof paymentFieldMap
> {
  private readonly repository: SheetRepositoryContract<PaymentsDbRow> | (() => SheetRepositoryContract<PaymentsDbRow>)
  private readonly reviewMapper = new Mapper(paymentFieldMap)
  private readonly now: () => Date
  private readonly generateId: () => string

  constructor(input: PaymentServiceOptions = {}) {
    super({
      repository: input.repository ?? getPaymentsRepository,
      api: paymentApiContract,
      searchFields: [],
      fieldMap: paymentFieldMap,
      transformer,
    })
    this.repository = input.repository ?? getPaymentsRepository
    this.now = input.now ?? (() => new Date())
    this.generateId = input.generateId ?? (() => generateShortId('PAY-'))
  }

  protected override prepareCreate(data: PaymentCreate): PaymentCreate & {
    paymentId: string
    status: 'VERIFIED'
    createdAt: string
    createdBy: string
    slipData: null
    updatedAt: null
    updatedBy: null
    deletedAt: null
    deletedBy: null
  } {
    const timestamp = formatBangkokTimestamp(this.now())
    return {
      ...data,
      paymentId: this.generateId(),
      status: 'VERIFIED',
      paidAt: data.paidAt ?? timestamp,
      createdAt: timestamp,
      createdBy: FALLBACK_ACTOR,
      slipData: null,
      updatedAt: null,
      updatedBy: null,
      deletedAt: null,
      deletedBy: null,
    }
  }

  /**
   * Staff review of a PENDING payment: VERIFY fills the amount and counts it toward
   * the invoice; REJECT marks it FAILED with a reason. Any other status is final.
   */
  override async update(id: string, payload: unknown): Promise<PaymentReviewResponse> {
    const paymentId = id.trim()
    if (paymentId === '') throw ApiError.badRequest('id is required')
    const review = parseOrThrow(paymentApiContract.request.update, payload)

    const repository = typeof this.repository === 'function' ? this.repository() : this.repository
    const rows = await repository.read(ReadQueryDTO.fromId<Partial<PaymentsDbRow>>(paymentId))
    if (rows.length === 0) throw ApiError.notFound(`Payment '${paymentId}' not found`)
    if (rows.length > 1) throw ApiError.conflict(`Payment '${paymentId}' resolved to multiple rows`)
    const existing = rows[0]
    if (existing.status !== 'PENDING') {
      throw ApiError.conflict(`Only a PENDING payment can be reviewed; this one is ${String(existing.status)}`)
    }

    const timestamp = formatBangkokTimestamp(this.now())
    const notes = appendNote(existing.notes, review.notes)
    const patch: Partial<PaymentsDbRow> = review.action === 'VERIFY'
      ? {
          status: 'VERIFIED',
          amount: review.amount,
          paid_at: review.paidAt ?? (typeof existing.paid_at === 'string' && existing.paid_at ? existing.paid_at : timestamp),
        }
      : { status: 'FAILED' }
    if (notes !== undefined) patch.notes = notes
    patch.updated_at = timestamp
    patch.updated_by = FALLBACK_ACTOR

    const updated = await repository.update(paymentId, patch)
    const apiRow = mapDbRowToApi(blankTextToNull(updated) as Record<string, unknown>, this.reviewMapper, {})
    const response: Record<string, unknown> = {}
    for (const field of Object.keys(paymentApiContract.response.update.shape)) {
      response[field] = apiRow[field]
    }
    return response as PaymentReviewResponse
  }
}

export const paymentService = new PaymentService()
export const paymentRoutes = createCrudRoutes(paymentService, paymentApiContract)
