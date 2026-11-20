import { z } from 'zod'
import { stockTakeScanSchema } from '@contracts/stock-takes/stock-take-api.schema'
import { laundryTagIdSchema } from '@contracts/laundry-tag-prints/laundry-tag-print.schema'
import { ApiError } from '@/shared/api/api-client'
import type { StockTakeScan } from '@/data/stock-takes/stock-take.service'
import { normalizeGarmentTagId } from '@/shared/utils/garment-tag-id'
import { readScanCode } from '@/shared/utils/scan-code'

export type CountDepartment = 'Washing' | 'DryCleaning' | 'Ironing' | 'Packaging'
export type CountStatus = 'Pending' | 'In Progress'
export type CountZone = { department: CountDepartment; status: CountStatus } | { department: null; status: 'Packed' }
export type BagContext = { mode: 'unset' } | { mode: 'bag'; bagId: string } | { mode: 'none' }
export type CountInput =
  | { kind: 'garment'; tag: string }
  | { kind: 'bag'; bagId: string }
  | { kind: 'staff' }
  | { kind: 'invalid'; message: string }
export type SendFailure = { action: 'retry' | 'hold' | 'drop'; message: string }

export const MAX_SCANS_PER_REQUEST = 50
export const MAX_RECENT_SCANS = 8

export const countDepartments: readonly { code: CountDepartment; label: string }[] = [
  { code: 'Washing', label: 'Washing' },
  { code: 'DryCleaning', label: 'Dry Cleaning' },
  { code: 'Ironing', label: 'Ironing' },
  { code: 'Packaging', label: 'Packaging' },
]
export const countStatuses: readonly CountStatus[] = ['Pending', 'In Progress']
export const packedZone: CountZone = { department: null, status: 'Packed' }

export function departmentZone(department: CountDepartment, status: CountStatus): CountZone {
  return { department, status }
}

export function sameZone(left: CountZone, right: CountZone): boolean {
  return left.department === right.department && left.status === right.status
}

export function zoneLabel(zone: CountZone): string {
  if (zone.department === null) return 'Packed'
  return `${countDepartments.find(entry => entry.code === zone.department)?.label ?? zone.department} · ${zone.status}`
}

export function readCountInput(value: string): CountInput {
  const code = readScanCode(value)
  if (code.kind === 'staff') return { kind: 'staff' }
  if (code.kind === 'order') return { kind: 'invalid', message: 'Order codes cannot be counted' }
  if (code.kind === 'bag') {
    const bagId = code.id.trim()
    return bagId && !bagId.startsWith('=') ? { kind: 'bag', bagId } : { kind: 'invalid', message: 'Bag code is not readable' }
  }
  const tag = normalizeGarmentTagId(code.id)
  return tag && laundryTagIdSchema.safeParse(tag).success ? { kind: 'garment', tag } : { kind: 'invalid', message: 'Not a garment tag' }
}

export function bagLabel(bag: BagContext): string {
  return bag.mode === 'bag' ? `Bag ${bag.bagId}` : bag.mode === 'none' ? 'Bag has no QR' : 'No bag selected'
}

export function buildScan(tag: string, zone: CountZone, bag: BagContext): { scan: StockTakeScan } | { error: string } {
  if (zone.department !== null) return { scan: { tag, department: zone.department, status: zone.status, bagId: null } }
  if (bag.mode === 'unset') return { error: 'Scan the bag QR first, or press "Bag has no QR"' }
  return { scan: { tag, department: null, status: 'Packed', bagId: bag.mode === 'bag' ? bag.bagId : null } }
}

export function scanKey(scan: StockTakeScan): string {
  return [scan.tag, scan.department ?? '', scan.status, scan.bagId ?? ''].join('|')
}

export function restoreScanQueue(value: unknown): StockTakeScan[] {
  const parsed = z.array(stockTakeScanSchema).safeParse(value)
  if (!parsed.success) return []
  const seen = new Set<string>()
  return parsed.data.filter(scan => {
    const key = scanKey(scan)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function classifySendFailure(error: unknown): SendFailure {
  if (!(error instanceof ApiError)) return { action: 'retry', message: 'Connection lost. Retrying' }
  if (error.status === 401 || error.status === 403) return { action: 'hold', message: error.message }
  if (error.status === 408 || error.status === 429 || error.status >= 500) return { action: 'retry', message: 'Could not save. Retrying' }
  return { action: 'drop', message: error.message }
}

export function retryDelayMs(attempt: number): number {
  return Math.min(30_000, 2_000 * 2 ** Math.max(0, attempt - 1))
}

export function takeBatch(queue: readonly StockTakeScan[]): StockTakeScan[] {
  return queue.slice(0, MAX_SCANS_PER_REQUEST)
}

export function removeSent(queue: readonly StockTakeScan[], sent: readonly StockTakeScan[]): StockTakeScan[] {
  const sentKeys = new Set(sent.map(scanKey))
  return queue.filter(scan => !sentKeys.has(scanKey(scan)))
}
