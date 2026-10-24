import type { LaundryItemDto } from '@/data/laundry-items/laundry-item.service'
import type { LaundryItemPhotoDto } from '@/data/laundry-item-photos/laundry-item-photo.service'
import type { OrderGarmentDto } from '@/data/order-garments/order-garment.service'
import type { OrderListDto } from '@/data/orders/order.service'
import type { JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { formatSheetDate, formatSheetDateTime, sheetTimestampMs } from '@/shared/utils/sheet-date'

export function garmentDate(value: string | null | undefined, withTime = false): string {
  if (!value) return '–'
  const formatted = withTime ? formatSheetDateTime(value).replace(/:\d{2}$/, '') : formatSheetDate(value)
  return formatted === '—' ? '–' : formatted.replace(/^0/, '')
}

export function garmentOrderRows(tag: string, links: readonly OrderGarmentDto[], orders: readonly OrderListDto[]): OrderListDto[] {
  const ids = new Set(links.filter(row => row.laundryItemId === tag && row.deletedAt === null).map(row => row.orderId))
  return orders.filter(order => ids.has(order.orderId)).sort((a, b) =>
    (b.receivedDate ?? '').localeCompare(a.receivedDate ?? '') || b.orderId.localeCompare(a.orderId))
}

export function garmentTimeline(tag: string, orderId: string, tickets: readonly JobTicketDto[]) {
  return tickets.filter(ticket => ticket.deletedAt === null && ticket.laundryItemId === tag && ticket.orderId === orderId)
    .sort((a, b) => a.stepNo - b.stepNo || a.id.localeCompare(b.id))
    .map(ticket => ({
      ...ticket,
      departmentLabel: ticket.department === 'DryCleaning' ? 'Dry cleaning' : ticket.department,
      state: ticket.status === 'Completed' ? 'done' : ticket.status === 'In Progress' ? 'current' : 'future',
      events: [
        ...(ticket.startedAt ? [{ label: 'Started', at: ticket.startedAt, staff: ticket.startedBy }] : []),
        ...(ticket.completedAt ? [{ label: 'Completed', at: ticket.completedAt, staff: ticket.scannedBy }] : []),
      ],
    }))
}

export function garmentCurrentPlace(tag: string, order: OrderListDto | undefined, tickets: readonly JobTicketDto[]): string | null {
  if (!order || ['COMPLETED', 'CANCELLED', 'DELIVERED'].includes(order.status?.toUpperCase() ?? '')) return null
  const steps = garmentTimeline(tag, order.orderId, tickets)
  const current = steps.find(step => step.status === 'In Progress')
  if (current) return `${current.departmentLabel} now`
  const pending = steps.find(step => step.status === 'Pending')
  return pending ? `${pending.departmentLabel} next` : null
}

export function garmentLastSeen(tag: string, tickets: readonly JobTicketDto[]): string | null {
  const times = tickets.filter(ticket => ticket.deletedAt === null && ticket.laundryItemId === tag)
    .flatMap(ticket => [ticket.startedAt, ticket.completedAt])
    .filter((value): value is string => value !== null && sheetTimestampMs(value) !== null)
  return times.sort((a, b) => sheetTimestampMs(b)! - sheetTimestampMs(a)!)[0] ?? null
}

export interface GarmentAlbumPhoto {
  id: string
  src: string
  alt: string
  orderId: string | null
  date: string | null
}

export function garmentAlbum(garment: LaundryItemDto, photos: readonly LaundryItemPhotoDto[], orders: readonly OrderListDto[]) {
  const orderDates = new Map(orders.map(order => [order.orderId, order.receivedDate]))
  const sections = ([['REGISTRATION', 'Registration'], ['DEFECT', 'Defects'], ['BEFORE', 'Before'], ['AFTER', 'After']] as const)
    .map(([type, title]) => ({
      type, title,
      photos: photos.filter(photo => photo.deletedAt === null && photo.laundryItemId === garment.id && photo.photoType === type)
        .map((photo): GarmentAlbumPhoto => ({
          id: photo.id, src: photo.imageUrl, alt: `${title} photo`, orderId: photo.orderId,
          date: photo.orderId ? orderDates.get(photo.orderId) ?? null : null,
        })),
    }))
  if (garment.imageUrl && !sections[0].photos.some(photo => photo.src === garment.imageUrl)) {
    sections[0].photos.unshift({ id: `registration:${garment.id}`, src: garment.imageUrl, alt: 'Registration photo', orderId: null, date: null })
  }
  return sections.filter(section => section.photos.length > 0)
}
