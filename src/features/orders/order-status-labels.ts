export const orderStatusLabels = {
  PENDING: 'Pending',
  RECEIVED: 'Received',
  COMPLETED: 'Completed',
} as const

export function getOrderStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null
  return orderStatusLabels[status as keyof typeof orderStatusLabels] ?? status
}

export { serviceTypeLabel as getOrderServiceTypeLabel } from '@/shared/utils/service-type-labels'
