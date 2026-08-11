import { formatSheetDate } from '@/shared/utils/sheet-date'

/** Backward-compatible wrapper for callers outside the order-history views. */
export function formatShortDate(value: string | null): string {
  return formatSheetDate(value, '—', { day: '2-digit' })
}
