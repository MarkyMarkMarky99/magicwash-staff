import { apiGet } from '@/shared/api/api-client'
import { authFetch } from '@/shared/api/firebase-auth'
import { invalidate } from '@/shared/api/response-cache'

export interface PackageBillPreview {
  customerId: string
  billingPeriodStart: string
  billingPeriodEnd: string
  allowance: number
  usedCredit: number
  carriedIn: number
  carriedOut: number
  balance: number
  overage: number
  feeLine: BillLine | null
  feeAlreadyInvoiced: boolean
  feeInvoiceNumber: string | null
  pendingOverage: { invoiceNumber: string; credits: number } | null
  alreadyInvoicedOrders: Array<{ orderId: string; invoiceNumber: string }>
  coveredByManualUsage: Array<{ orderId: string; credits: number }>
  overageLine: BillLine | null
  cashLines: BillLine[]
  unpricedItems: Array<{ sourceItemId: string; reason: string }>
  creditOrdersWithoutUsage: Array<{ orderId: string; totalCredits: number }>
}

export interface BillLine {
  description: string
  quantity: number
  unit: string
  unitPrice: number
  sourceOrderId?: string
  sourceItemId?: string
  serviceType?: string
  packageOverageId?: string
  packageFeeId?: string
}

export function getPackageBillPreview(customerPackageId: string): Promise<PackageBillPreview> {
  return apiGet<PackageBillPreview>(`/api/package-billing?${new URLSearchParams({ customerPackageId })}`)
}

export async function settlePackageOverage(customerPackageId: string, invoiceNumber: string, createdBy: string): Promise<void> {
  const response = await authFetch('/api/package-billing', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerPackageId, invoiceNumber, createdBy }) })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Unable to close overage')
  }
  invalidate('/api/customer-packages')
}
