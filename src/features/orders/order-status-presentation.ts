import type { BadgeTone } from '@/shared/components/BaseBadge.vue'

export interface StatusPresentation {
  icon: string
  label: string
  badgeTone: BadgeTone
  avatarClass: string
}

// Unknown status values fall through to a neutral presentation rather than guessing.
export const STATUS_PRESENTATION: Record<string, StatusPresentation> = {
  SUBMITTED: { icon: 'local_laundry_service', label: 'Submitted', badgeTone: 'warning', avatarClass: 'bg-amber-50 text-amber-600' },
  PENDING: { icon: 'schedule', label: 'Pending', badgeTone: 'warning', avatarClass: 'bg-amber-50 text-amber-600' },
  APPROVED: { icon: 'task_alt', label: 'Approved', badgeTone: 'info', avatarClass: 'bg-blue-50 text-blue-700' },
  RECEIVED: { icon: 'inventory_2', label: 'Received', badgeTone: 'accent', avatarClass: 'bg-teal-50 text-teal-700' },
  COMPLETED: { icon: 'done_all', label: 'Completed', badgeTone: 'success', avatarClass: 'bg-green-50 text-green-700' },
  CANCELLED: { icon: 'cancel', label: 'Cancelled', badgeTone: 'danger', avatarClass: 'bg-red-50 text-red-600' },
}

export const FALLBACK_PRESENTATION: StatusPresentation = {
  icon: 'receipt_long',
  label: 'Unknown',
  badgeTone: 'neutral',
  avatarClass: 'bg-gray-100 text-gray-500',
}

export function presentationFor(status: string | null): StatusPresentation {
  if (!status) return FALLBACK_PRESENTATION
  return STATUS_PRESENTATION[status] ?? { ...FALLBACK_PRESENTATION, label: status }
}
