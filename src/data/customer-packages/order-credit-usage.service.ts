import type { z } from 'zod'
import type { orderCreditUsagePreviewSchema } from '@contracts/customer-packages/customer-package-api.schema'
import { apiGet } from '@/shared/api/api-client'
import { authFetch } from '@/shared/api/firebase-auth'
import { invalidate } from '@/shared/api/response-cache'

export type OrderCreditUsagePreview = z.infer<typeof orderCreditUsagePreviewSchema>

export function getOrderCreditUsage(customerPackageId: string, orderId: string): Promise<OrderCreditUsagePreview> {
  const query = new URLSearchParams({ customerPackageId, orderId })
  return apiGet<OrderCreditUsagePreview>(`/api/order-credit-usage?${query}`)
}

export async function confirmOrderCreditUsage(customerPackageId: string, orderId: string, createdBy: string, manualCredits?: number): Promise<void> {
  const response = await authFetch('/api/order-credit-usage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerPackageId, orderId, createdBy, ...(manualCredits === undefined ? {} : { manualCredits }) }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Unable to record order credit usage')
  }
  invalidate('/api/customer-packages')
  invalidate('/api/package-transactions')
}
