import { apiGet } from '@/shared/api/api-client'
import { authFetch } from '@/shared/api/firebase-auth'
import { invalidate } from '@/shared/api/response-cache'

export interface RenewalTransferStatus { newPackageId: string; referenceId: string; credits: number; pending: boolean }

export function getRenewalTransfers(oldPackageId: string): Promise<{ transfers: RenewalTransferStatus[] }> {
  return apiGet<{ transfers: RenewalTransferStatus[] }>(`/api/package-renewal?${new URLSearchParams({ oldPackageId })}`)
}

export async function transferRenewalCredits(oldPackageId: string, newPackageId: string, createdBy: string): Promise<void> {
  const response = await authFetch('/api/package-renewal', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPackageId, newPackageId, createdBy }) })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Unable to transfer carry-over credits')
  }
  invalidate('/api/customer-packages')
}
