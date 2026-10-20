import { addSheetDateDays, getSheetDateCalendar, sheetDateDaysBetween, todaySheetDate } from '@/shared/utils/sheet-date'
import type { CorporateOrderItem } from './corporate-order-items'
import type { ItemDto } from '@/data/items/items.service'
import type { WorkOrderCreatePayload } from '@/data/work-orders/work-order.service'

export const CORPORATE_ORDER_SERVICE_TYPE = 'WASH'
export const CORPORATE_ORDER_TURNAROUND_DAYS = 2
export const MAX_COUNTED = 9999

export interface CorporateOrderLine {
  key: string
  itemCode: string | null
  nameEn: string | null
  nameTh: string
  imageUrl: string | null
  counted: number | null
  added: boolean
}

export interface SlipPhoto {
  id: string
  file: File
  url: string
}

export interface CorporateOrderDraft {
  customerId: string
  receivedDate: string
  dueDate: string
  serviceType: typeof CORPORATE_ORDER_SERVICE_TYPE
  lines: CorporateOrderLine[]
  slipPhotos: SlipPhoto[]
}

export function corporateOrderCreatePayload(
  draft: CorporateOrderDraft,
  rows: readonly Pick<ItemDto, 'id' | 'itemCode' | 'active'>[],
  createdBy: string,
): WorkOrderCreatePayload {
  const items = draft.lines.filter((line) => line.counted !== null && line.counted > 0).map((line) => {
    const item = rows.find((row) => row.active && row.itemCode === line.itemCode)
      ?? rows.find((row) => row.itemCode === line.itemCode)
    return {
      itemId: line.added ? null : item?.id ?? null,
      description: lineTitle(line),
      quantity: line.counted!,
      price: null,
      specialInstructions: null,
    }
  })
  return {
    customerId: draft.customerId,
    receivedDate: draft.receivedDate,
    dueDate: draft.dueDate,
    serviceType: draft.serviceType,
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    orderName: null,
    note: null,
    orderDescription: null,
    createdBy,
    items,
  }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function defaultOrderDates(now: Date = new Date()): { receivedDate: string, dueDate: string } {
  const receivedDate = todaySheetDate(now)
  return { receivedDate, dueDate: addSheetDateDays(receivedDate, CORPORATE_ORDER_TURNAROUND_DAYS) }
}

export function listLine(item: CorporateOrderItem, counted: number | null = null): CorporateOrderLine {
  return { key: item.itemCode, ...item, counted, added: false }
}

export function addedLine(key: string, name: string, counted: number | null): CorporateOrderLine {
  return { key, itemCode: null, nameEn: null, nameTh: name.trim(), imageUrl: null, counted, added: true }
}

// Counts survive a refresh of the item list; added lines always stay.
export function mergeListLines(current: readonly CorporateOrderLine[], items: readonly CorporateOrderItem[]): CorporateOrderLine[] {
  const counts = new Map(current.filter((line) => !line.added).map((line) => [line.key, line.counted]))
  return [
    ...items.map((item) => listLine(item, counts.get(item.itemCode) ?? null)),
    ...current.filter((line) => line.added),
  ]
}

export function parseCountInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, '').slice(0, String(MAX_COUNTED).length)
  return digits === '' ? null : Number.parseInt(digits, 10)
}

export function stepCount(counted: number | null, delta: number): number | null {
  if (counted === null && delta < 0) return null
  return Math.min(MAX_COUNTED, Math.max(0, (counted ?? 0) + delta))
}

export function countedLineCount(lines: readonly CorporateOrderLine[]): number {
  return lines.filter((line) => line.counted !== null).length
}

export function totalCounted(lines: readonly CorporateOrderLine[]): number {
  return lines.reduce((sum, line) => sum + (line.counted ?? 0), 0)
}

export function lineTitle(line: CorporateOrderLine): string {
  return line.nameEn ?? line.nameTh
}

export function lineSubtitle(line: CorporateOrderLine): string | null {
  if (line.added) return 'Not on the list'
  return line.nameEn ? line.nameTh : null
}

export function dueStubLabel(date: string): { day: string, month: string } {
  const calendar = getSheetDateCalendar(date)
  if (!calendar) return { day: '–', month: 'Set date' }
  return { day: String(calendar.day), month: `${WEEKDAYS[calendar.weekday]} · ${MONTHS[calendar.month - 1]}` }
}

export function receivedLabel(date: string): string {
  const calendar = getSheetDateCalendar(date)
  if (!calendar) return 'Set date'
  return `${WEEKDAYS[calendar.weekday]} ${calendar.day} ${MONTHS[calendar.month - 1]}`
}

export function turnaround(receivedDate: string, dueDate: string): { label: string, valid: boolean } {
  const days = sheetDateDaysBetween(dueDate, receivedDate)
  if (days === null) return { label: 'Set both dates', valid: false }
  if (days < 0) return { label: 'Due is before received', valid: false }
  if (days === 0) return { label: 'Same day', valid: true }
  return { label: days === 1 ? '1 day' : `${days} days`, valid: true }
}
