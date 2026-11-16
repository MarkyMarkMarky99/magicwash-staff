import { formatSheetDateTime } from '@/shared/utils/sheet-date'

export function formatEventTime(value: string): string {
  return formatSheetDateTime(value).replace(/:\d{2}$/, '')
}
