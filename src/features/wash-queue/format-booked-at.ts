import { formatSheetDate, todaySheetDate } from '@/shared/utils/sheet-date'

// createdAt arrives as `yyyy-MM-dd HH:mm:ss` in Asia/Bangkok.
export function formatBookedAt(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):\d{2}$/.exec(value.trim())
  if (!match) return formatSheetDate(value)
  return match[1] === todaySheetDate() ? `today ${match[2]}` : `${formatSheetDate(match[1])} ${match[2]}`
}
