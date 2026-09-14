import { z } from 'zod'
import {
  appendPackageTransactionRequestSchema,
  appendPackageTransactionResponseSchema,
} from '@contracts/customer-packages/customer-package-api.schema'
import { invalidate } from '@/shared/api/response-cache'

type AppendPackageTransactionRequest = z.infer<typeof appendPackageTransactionRequestSchema>
type AppendPackageTransactionResponse = z.infer<typeof appendPackageTransactionResponseSchema>

function unknownTransactionOutcome(request: AppendPackageTransactionRequest, message: string): AppendPackageTransactionResponse {
  return {
    kind: 'transaction_write_failed',
    customerPackageId: request.customerPackageId,
    message,
    certainty: 'unknown',
  }
}

export async function appendPackageTransaction(request: AppendPackageTransactionRequest): Promise<AppendPackageTransactionResponse> {
  try {
    const response = await fetch('/api/package-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appendPackageTransactionRequestSchema.parse(request)),
    })
    let body: unknown
    try {
      body = await response.json()
    } catch {
      return unknownTransactionOutcome(request, 'The server response could not be read. This transaction may already have been saved.')
    }
    const parsed = appendPackageTransactionResponseSchema.safeParse(body)
    if (!parsed.success) {
      return unknownTransactionOutcome(request, 'The server response was not a recognized write outcome. This transaction may already have been saved.')
    }
    if (parsed.data.kind === 'created') invalidate('/api/customer-packages')
    return parsed.data
  } catch {
    return unknownTransactionOutcome(request, 'Could not reach the server. This transaction may already have been saved.')
  }
}
