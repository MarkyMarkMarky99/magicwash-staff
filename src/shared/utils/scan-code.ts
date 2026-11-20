import { readScanCode } from '@shared/utils/scan-code'

export { readScanCode, type ScanCode } from '@shared/utils/scan-code'

export function anyPageGarmentScan(value: string, signedIn: boolean, meta: Readonly<Record<string, unknown>>): string | null {
  if (!signedIn || meta.public === true || meta.ownsWorkScan === true) return null
  const code = readScanCode(value)
  return code.kind === 'garment' ? code.id : null
}
