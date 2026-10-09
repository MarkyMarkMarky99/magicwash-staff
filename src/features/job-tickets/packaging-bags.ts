import { formatSheetDateTime, getBangkokClock } from '@/shared/utils/sheet-date'
import type { z } from 'zod'
import type { jobTicketDepartmentSchema } from '@contracts/job-tickets/job-ticket-api.schema'
import { departmentLabels } from './scan-result'

export type PackagingGarment = {
  tagId: string
  imageUrl: string | null
  waitingFor: z.infer<typeof jobTicketDepartmentSchema> | null
  confirmedBagId: string | null
}

export type ConfirmedBag = { id: string; photoUrl: string | null; confirmedAt: string }

export type PackagingOrder = {
  orderId: string
  customerName: string
  customerIndex: string
  statusLabel: string
  garments: PackagingGarment[]
  confirmedBags: ConfirmedBag[]
}

export type NewBag = { id: string; garmentTagIds: string[]; photoUrl: string | null }

export type StoredBag = NewBag

export type BagScanOutcome = { bags: NewBag[]; tagId: string; success: boolean; message: string }

export type GarmentState =
  | { kind: 'free' }
  | { kind: 'selected' }
  | { kind: 'inBag'; bagNumber: number }
  | { kind: 'waiting'; label: string }

export function bagNumber(order: PackagingOrder, bags: readonly NewBag[], bagId: string): number {
  return order.confirmedBags.length + bags.findIndex(bag => bag.id === bagId) + 1
}

export function garmentsInNewBags(bags: readonly NewBag[]): number {
  return bags.reduce((total, bag) => total + bag.garmentTagIds.length, 0)
}

export function packedCount(order: PackagingOrder): number {
  return order.garments.filter(garment => garment.confirmedBagId).length
}

export function unassignedCount(order: PackagingOrder, bags: readonly NewBag[]): number {
  return order.garments.length - packedCount(order) - garmentsInNewBags(bags)
}

export function confirmedItemCount(order: PackagingOrder, bagId: string): number {
  return order.garments.filter(garment => garment.confirmedBagId === bagId).length
}

export function canConfirm(bags: readonly NewBag[]): boolean {
  return bags.length > 0 && bags.every(bag => bag.photoUrl && bag.garmentTagIds.length > 0)
}

export function garmentState(order: PackagingOrder, bags: readonly NewBag[], bagId: string, garment: PackagingGarment): GarmentState {
  const holder = bags.find(bag => bag.garmentTagIds.includes(garment.tagId))
  if (holder?.id === bagId) return { kind: 'selected' }
  if (holder) return { kind: 'inBag', bagNumber: bagNumber(order, bags, holder.id) }
  if (garment.waitingFor) return { kind: 'waiting', label: departmentLabels[garment.waitingFor] }
  return { kind: 'free' }
}

export function toggleGarment(order: PackagingOrder, bags: readonly NewBag[], bagId: string, tagId: string): NewBag[] {
  const garment = order.garments.find(row => row.tagId === tagId)
  if (!garment || garment.confirmedBagId) return [...bags]
  const state = garmentState(order, bags, bagId, garment)
  if (state.kind !== 'selected' && state.kind !== 'free') return [...bags]
  return bags.map(bag => bag.id !== bagId ? bag : {
    ...bag,
    garmentTagIds: state.kind === 'selected' ? bag.garmentTagIds.filter(id => id !== tagId) : [...bag.garmentTagIds, tagId],
  })
}

export function scanGarment(order: PackagingOrder, bags: readonly NewBag[], bagId: string, value: string): BagScanOutcome {
  const tagId = value.trim()
  const fail = (message: string): BagScanOutcome => ({ bags: [...bags], tagId, success: false, message })
  const garment = order.garments.find(row => row.tagId === tagId)
  if (!garment) return fail('Not a garment of this order')
  if (garment.confirmedBagId) return fail('Already in a confirmed bag')
  const state = garmentState(order, bags, bagId, garment)
  if (state.kind === 'selected') return fail('Already in this bag')
  if (state.kind === 'inBag') return fail(`In Bag ${state.bagNumber}`)
  if (state.kind === 'waiting') return fail(`Waiting: ${state.label}`)
  return { bags: toggleGarment(order, bags, bagId, tagId), tagId, success: true, message: 'Added to this bag' }
}

export function confirmBags(order: PackagingOrder, bags: readonly NewBag[], confirmedAt: string): PackagingOrder {
  const placed = new Map(bags.flatMap(bag => bag.garmentTagIds.map(tagId => [tagId, bag.id] as const)))
  return {
    ...order,
    garments: order.garments.map(garment => ({ ...garment, confirmedBagId: placed.get(garment.tagId) ?? garment.confirmedBagId })),
    confirmedBags: [...order.confirmedBags, ...bags.map(bag => ({ id: bag.id, photoUrl: bag.photoUrl, confirmedAt }))],
  }
}

export function restoreBags(order: PackagingOrder, value: unknown): NewBag[] {
  if (!Array.isArray(value)) return []
  const known = new Map(order.garments.map(garment => [garment.tagId, garment]))
  const taken = new Set<string>()
  const restored: NewBag[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !Array.isArray(entry.garmentTagIds)) continue
    if (restored.some(bag => bag.id === entry.id)) continue
    const garmentTagIds: string[] = []
    for (const tagId of entry.garmentTagIds) {
      const garment = typeof tagId === 'string' ? known.get(tagId) : undefined
      if (!garment || (garment.confirmedBagId && garment.confirmedBagId !== entry.id) || garment.waitingFor || taken.has(garment.tagId)) continue
      taken.add(garment.tagId)
      garmentTagIds.push(garment.tagId)
    }
    restored.push({ id: entry.id, garmentTagIds, photoUrl: typeof entry.photoUrl === 'string' && /^https?:\/\//.test(entry.photoUrl) ? entry.photoUrl : null })
  }
  return restored
}

export function confirmedTimestamp(now: Date = new Date()): string {
  const clock = getBangkokClock(now)
  const hours = String(Math.floor(clock.minutes / 60)).padStart(2, '0')
  const minutes = String(clock.minutes % 60).padStart(2, '0')
  return `${clock.date} ${hours}:${minutes}:00`
}

export function formatConfirmedAt(value: string): string {
  return formatSheetDateTime(value).replace(/ (\d{2}:\d{2}):\d{2}$/, ' · $1')
}
