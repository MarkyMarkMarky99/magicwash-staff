export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function toNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  // Number() looks like it can only return NaN on bad input, but it throws
  // on a Symbol (`Number(Symbol())` → TypeError) — this cell decoder must
  // never throw on dirty data, so the try/catch stays.
  try {
    const result = Number(value)
    return Number.isNaN(result) ? null : result
  } catch {
    return null
  }
}

/**
 * GViz returns date cells as `Date(Y,M,D)` (M is 0-indexed). An empty string
 * is treated as `null`, not passed through — a blank date cell carries no
 * information, so callers get the same "absent" value as a missing cell.
 */
export function normalizeGVizDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    return null
  }

  const match = value.match(/^Date\((\d+),(\d+),(\d+)\)$/)
  if (!match) {
    return value
  }

  const [, year, month, day] = match
  return `${year}-${String(Number(month) + 1).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`
}

export function parseJsonArray(value: unknown): unknown[] {
  if (typeof value !== 'string') {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string') {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(value)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}
