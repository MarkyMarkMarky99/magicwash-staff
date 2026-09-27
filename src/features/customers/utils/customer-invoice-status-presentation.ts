import type { BadgeTone } from '@/shared/components/BaseBadge.vue'

interface InvoiceStatusPresentation {
  label: string
  tone: BadgeTone
}

const STATUS_PRESENTATION: Record<string, InvoiceStatusPresentation> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  UNPAID: { label: 'Unpaid', tone: 'danger' },
  OVERDUE: { label: 'Overdue', tone: 'danger' },
  PARTIALLY_PAID: { label: 'Partially paid', tone: 'info' },
  PAID: { label: 'Paid', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  VOID: { label: 'Void', tone: 'danger' },
}

const FALLBACK_PRESENTATION: InvoiceStatusPresentation = {
  label: 'Unknown',
  tone: 'neutral',
}

export function invoiceStatusPresentation(status: string | null): InvoiceStatusPresentation {
  if (!status) return FALLBACK_PRESENTATION
  return STATUS_PRESENTATION[status] ?? { ...FALLBACK_PRESENTATION, label: status }
}
