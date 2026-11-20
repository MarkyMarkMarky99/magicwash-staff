export function normalizeGarmentTagId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).padStart(8, '0')
  return null
}
