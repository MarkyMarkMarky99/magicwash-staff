import type { BadgeTone } from '@/shared/components/BaseBadge.vue'

export interface StatusPresentation {
  label: string
  tone: BadgeTone
}

export const STATUS_PRESENTATION: Record<string, StatusPresentation> = {
  SUBMITTED: { label: 'Submitted', tone: 'warning' },
  PENDING: { label: 'Pending', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'info' },
  RECEIVED: { label: 'Received', tone: 'accent' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
}

export const FALLBACK_PRESENTATION: StatusPresentation = {
  label: 'Unknown',
  tone: 'neutral',
}

export function presentationFor(status: string | null): StatusPresentation {
  if (!status) return FALLBACK_PRESENTATION
  return STATUS_PRESENTATION[status] ?? { ...FALLBACK_PRESENTATION, label: status }
}
