import type { BadgeTone } from '@/shared/components/BaseBadge.vue'

export interface StatusPresentation {
  icon: string
  label: string
  tone: BadgeTone
}

// Unknown status values fall through to a neutral presentation rather than guessing.
export const STATUS_PRESENTATION: Record<string, StatusPresentation> = {
  DRAFT: { icon: 'draft', label: 'Draft', tone: 'neutral' },
  UNPAID: { icon: 'schedule', label: 'Unpaid', tone: 'danger' },
  OVERDUE: { icon: 'priority_high', label: 'Overdue', tone: 'danger' },
  PARTIALLY_PAID: { icon: 'hourglass_bottom', label: 'Partially paid', tone: 'info' },
  PAID: { icon: 'task_alt', label: 'Paid', tone: 'success' },
  CANCELLED: { icon: 'cancel', label: 'Cancelled', tone: 'danger' },
  VOID: { icon: 'block', label: 'Void', tone: 'danger' },
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
