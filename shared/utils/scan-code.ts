export function isStaffCardCode(code: string): boolean {
  return code.trim().toUpperCase().startsWith('MWS-')
}

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
