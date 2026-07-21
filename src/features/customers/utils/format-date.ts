/** Human-readable short date ("27 Oct 2025") for an ISO YYYY-MM-DD string. */
export function formatShortDate(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
