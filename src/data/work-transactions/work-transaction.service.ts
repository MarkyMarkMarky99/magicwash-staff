import type { z } from 'zod'
import { workTransactionListQuerySchema, type workTransactionSchema } from '@contracts/work-transactions/work-transaction-api.schema'
import { apiGet } from '@/shared/api/api-client'

export type WorkTransactionDto = z.infer<typeof workTransactionSchema>

export function listWorkTransactions(from: string, to: string): Promise<WorkTransactionDto[]> {
  const query = workTransactionListQuerySchema.parse({ from, to })
  return apiGet<WorkTransactionDto[]>(`/api/work-transactions?from=${query.from}&to=${query.to}`)
}
