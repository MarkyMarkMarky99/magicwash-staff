import { isStaffCardCode } from './staff-card'

export type ScanCode = { kind: 'staff' | 'garment' | 'bag' | 'order' | 'unknown'; id: string }

export function readScanCode(value: string): ScanCode {
  const text = value.trim()
  if (isStaffCardCode(text)) return { kind: 'staff', id: text }
  const prefix = text.slice(0, 4).toUpperCase()
  const kind = prefix === 'MWG-' ? 'garment' : prefix === 'MWB-' ? 'bag' : prefix === 'MWO-' ? 'order' : null
  if (kind) return { kind, id: text.slice(4) }
  const marker = text.lastIndexOf('/b/')
  if (marker !== -1) return { kind: 'bag', id: text.slice(marker + 3).trim() }
  return { kind: 'unknown', id: text }
}

export function anyPageGarmentScan(value: string, signedIn: boolean, meta: Readonly<Record<string, unknown>>): string | null {
  if (!signedIn || meta.public === true || meta.ownsWorkScan === true) return null
  const code = readScanCode(value)
  return code.kind === 'garment' ? code.id : null
}
