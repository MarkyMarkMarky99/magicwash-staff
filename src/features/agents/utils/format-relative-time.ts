import { formatSheetDate } from '@/shared/utils/sheet-date'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** Short relative time for a chat row: "Just now", "5m", "3h", "2d", then a Bangkok date. */
export function formatRelativeTime(value: string, now: number = Date.now()): string {
  const at = Date.parse(value)
  if (Number.isNaN(at)) return ''
  const elapsed = Math.max(0, now - at)
  if (elapsed < MINUTE_MS) return 'Just now'
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m`
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h`
  if (elapsed < 7 * DAY_MS) return `${Math.floor(elapsed / DAY_MS)}d`
  return formatSheetDate(value)
}
