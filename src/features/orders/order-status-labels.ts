export const orderStatusLabels = {
  PENDING: 'รอดำเนินการ',
  RECEIVED: 'รับผ้าแล้ว',
  COMPLETED: 'เสร็จแล้ว',
} as const

export function getOrderStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null
  return orderStatusLabels[status as keyof typeof orderStatusLabels] ?? status
}

// Service-type wording is shared with price-list and invoices — see
// `contracts/shared/service-type-labels.ts`. Do not add a local copy back here.
export { serviceTypeLabel as getOrderServiceTypeLabel } from '@contracts/shared/service-type-labels'
