import type { BadgeTone } from '@/shared/components/BaseBadge.vue'

export interface StatusPresentation {
  icon: string
  label: string
  tone: BadgeTone
}

export const STATUS_PRESENTATION: Record<string, StatusPresentation> = {
  SUBMITTED: { icon: 'local_laundry_service', label: 'Submitted', tone: 'warning' },
  PENDING: { icon: 'schedule', label: 'Pending', tone: 'warning' },
  APPROVED: { icon: 'task_alt', label: 'Approved', tone: 'info' },
  RECEIVED: { icon: 'inventory_2', label: 'Received', tone: 'accent' },
  COMPLETED: { icon: 'done_all', label: 'Completed', tone: 'success' },
  CANCELLED: { icon: 'cancel', label: 'Cancelled', tone: 'danger' },
}

export const FALLBACK_PRESENTATION: StatusPresentation = {
  icon: 'receipt_long',
  label: 'Unknown',
  tone: 'neutral',
}

export function presentationFor(status: string | null): StatusPresentation {
  if (!status) return FALLBACK_PRESENTATION
  return STATUS_PRESENTATION[status] ?? { ...FALLBACK_PRESENTATION, label: status }
}
