import { formatSheetDate, todaySheetDate } from '@/shared/utils/sheet-date'

// createdAt arrives as `yyyy-MM-dd HH:mm:ss` in Asia/Bangkok.
export function formatBookedAt(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):\d{2}$/.exec(value.trim())
  if (!match) return formatSheetDate(value)
  return match[1] === todaySheetDate() ? `today ${match[2]}` : `${formatSheetDate(match[1])} ${match[2]}`
}

// loadedAt uses the same format; In machine rows show it to the second, matching the running timer.
export function formatStartedAt(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(value.trim())
  if (!match) return `Started at ${formatSheetDate(value)}`
  return match[1] === todaySheetDate() ? `Started at ${match[2]}` : `Started at ${formatSheetDate(match[1])} ${match[2]}`
}
