import type { BadgeTone } from '@/shared/components/BaseBadge.vue'

interface InvoiceStatusPresentation {
  icon: string
  label: string
  tone: BadgeTone
}

const STATUS_PRESENTATION: Record<string, InvoiceStatusPresentation> = {
  DRAFT: { icon: 'draft', label: 'Draft', tone: 'neutral' },
  UNPAID: { icon: 'schedule', label: 'Unpaid', tone: 'danger' },
  OVERDUE: { icon: 'priority_high', label: 'Overdue', tone: 'danger' },
  PARTIALLY_PAID: { icon: 'hourglass_bottom', label: 'Partially paid', tone: 'info' },
  PAID: { icon: 'task_alt', label: 'Paid', tone: 'success' },
  CANCELLED: { icon: 'cancel', label: 'Cancelled', tone: 'danger' },
  VOID: { icon: 'block', label: 'Void', tone: 'danger' },
}

const FALLBACK_PRESENTATION: InvoiceStatusPresentation = {
  icon: 'receipt_long',
  label: 'Unknown',
  tone: 'neutral',
}

export function invoiceStatusPresentation(status: string | null): InvoiceStatusPresentation {
  if (!status) return FALLBACK_PRESENTATION
  return STATUS_PRESENTATION[status] ?? { ...FALLBACK_PRESENTATION, label: status }
}
