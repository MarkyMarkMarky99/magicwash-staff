import type { z } from 'zod'
import { paymentApiContract } from '@contracts/payments/payment-api.schema'
import { apiPatch, apiPost } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'

export type CreatePaymentRequest = z.input<typeof paymentApiContract.request.create>
export type CreatePaymentResponse = z.infer<typeof paymentApiContract.response.create>
export type ReviewPaymentRequest = z.input<typeof paymentApiContract.request.update>
export type ReviewPaymentResponse = z.infer<typeof paymentApiContract.response.update>

const PAYMENTS_ENDPOINT = '/api/payments'

export async function createPayment(data: CreatePaymentRequest): Promise<CreatePaymentResponse> {
  const payment = await apiPost<CreatePaymentResponse>(PAYMENTS_ENDPOINT, {
    data,
    requestSchema: paymentApiContract.request.create,
  })
  // Invoice paid amount, balance, and status are derived from payments.
  invalidate('/api/invoices')
  return payment
}

/** Verify or reject a PENDING payment, such as a slip the verifier could not read. */
export async function reviewPayment(
  paymentId: string,
  data: ReviewPaymentRequest,
): Promise<ReviewPaymentResponse> {
  const payment = await apiPatch<ReviewPaymentResponse>(
    `${PAYMENTS_ENDPOINT}/${encodeURIComponent(paymentId)}`,
    { data, requestSchema: paymentApiContract.request.update },
  )
  invalidate('/api/invoices')
  return payment
}
