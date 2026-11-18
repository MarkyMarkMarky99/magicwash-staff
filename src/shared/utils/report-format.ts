const DAY_MS = 24 * 60 * 60 * 1000

export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

export function percentOf(count: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round(count / total * 100)))
}

export function changePercent(current: number, previous: number): string | null {
  if (previous === 0) return null
  const change = Math.round((current - previous) / previous * 100)
  return `${change > 0 ? '+' : ''}${change}%`
}

export function barHeights(values: readonly number[], maxPixels: number, minPixels = 4): number[] {
  const max = Math.max(...values, 1)
  return values.map((value) => Math.max(minPixels, Math.round(value / max * maxPixels)))
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

export function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function weekdayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
}

export function monthLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function tileLabel(date: string, today: string): string {
  return date === today ? `Today, ${shortDate(date)}` : `${weekdayLabel(date)}, ${shortDate(date)}`
}
