import { laundryItemPhotoTypeSchema } from '@contracts/laundry-item-photos/laundry-item-photo-api.schema'
import type { LaundryItemDto } from '@/data/laundry-items/laundry-item.service'
import type { LaundryItemPhotoDto } from '@/data/laundry-item-photos/laundry-item-photo.service'
import type { JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { formatSheetDate, formatSheetDateTime, sheetTimestampMs } from '@/shared/utils/sheet-date'

export function garmentDate(value: string | null | undefined, withTime = false): string {
  if (!value) return '–'
  const formatted = withTime ? formatSheetDateTime(value).replace(/:\d{2}$/, '') : formatSheetDate(value)
  return formatted === '—' ? '–' : formatted.replace(/^0/, '')
}

export function garmentInOrder(tag: string, orderId: string, tickets: readonly JobTicketDto[]): boolean {
  return tickets.some(row => row.laundryItemId === tag && row.orderId === orderId && row.deletedAt === null)
}

export function garmentOrderRows(tag: string, tickets: readonly JobTicketDto[], orderId: string | null = null): Array<{ orderId: string, createdAt: string | null }> {
  const dates = new Map<string, string | null>()
  for (const ticket of tickets) {
    if (ticket.deletedAt !== null || ticket.laundryItemId !== tag || (orderId !== null && ticket.orderId !== orderId)) continue
    const earliest = dates.get(ticket.orderId)
    if (earliest === undefined || earliest === null || (ticket.createdAt !== null && ticket.createdAt < earliest)) dates.set(ticket.orderId, ticket.createdAt)
  }
  return [...dates].map(([orderId, createdAt]) => ({ orderId, createdAt })).sort((a, b) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.orderId.localeCompare(a.orderId))
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

export function garmentCurrentPlace(tag: string, orderId: string | undefined, tickets: readonly JobTicketDto[]): string | null {
  if (!orderId) return null
  const steps = garmentTimeline(tag, orderId, tickets)
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

export type GarmentPhotoType = Exclude<LaundryItemPhotoDto['photoType'], 'REGISTRATION'>

export function garmentPhotoTypeLabel(type: LaundryItemPhotoDto['photoType']): string {
  return type.charAt(0) + type.slice(1).toLowerCase()
}

export function garmentPhotoTypeOptions(): Array<{ value: GarmentPhotoType, label: string }> {
  return laundryItemPhotoTypeSchema.options
    .filter((type): type is GarmentPhotoType => type !== 'REGISTRATION')
    .map(value => ({ value, label: garmentPhotoTypeLabel(value) }))
}

const photoTypeMeta: Record<string, { icon: string, hint: string }> = {
  DEFECT: { icon: 'report', hint: 'Damage or stain' },
  BEFORE: { icon: 'photo_camera_back', hint: 'As received' },
  AFTER: { icon: 'photo_camera_front', hint: 'After cleaning' },
}

export function garmentPhotoTypeIcon(type: LaundryItemPhotoDto['photoType']): string {
  return photoTypeMeta[type]?.icon ?? 'photo_camera'
}

export function garmentPhotoTypeHint(type: LaundryItemPhotoDto['photoType']): string {
  return photoTypeMeta[type]?.hint ?? ''
}

export interface GarmentHistoryPhoto {
  id: string
  src: string
  alt: string
  label: string
}

export function garmentSharedHistory(tag: string, photos: readonly LaundryItemPhotoDto[]): GarmentHistoryPhoto[] {
  return photos.filter(photo => photo.deletedAt === null && photo.laundryItemId === tag && photo.photoType !== 'REGISTRATION' && !photo.orderId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .map(photo => ({ id: photo.id, src: photo.imageUrl, alt: `${garmentPhotoTypeLabel(photo.photoType)} photo`, label: garmentPhotoTypeLabel(photo.photoType) }))
}

const albumTitles: Record<string, string> = { REGISTRATION: 'Registration', DEFECT: 'Defects', BEFORE: 'Before', AFTER: 'After' }
const albumOrder = [...Object.keys(albumTitles), ...laundryItemPhotoTypeSchema.options.filter(type => !(type in albumTitles))] as Array<LaundryItemPhotoDto['photoType']>

export function garmentAlbum(garment: LaundryItemDto, photos: readonly LaundryItemPhotoDto[], tickets: readonly JobTicketDto[], orderId: string | null = null) {
  const orderDates = new Map(garmentOrderRows(garment.id, tickets).map(order => [order.orderId, order.createdAt]))
  const sections = albumOrder.map(type => {
    const title = albumTitles[type] ?? garmentPhotoTypeLabel(type)
    return {
      type, title,
      photos: photos.filter(photo => photo.deletedAt === null && photo.laundryItemId === garment.id && photo.photoType === type
        && (orderId === null || type === 'REGISTRATION' || !photo.orderId || photo.orderId === orderId))
        .map((photo): GarmentAlbumPhoto => ({
          id: photo.id, src: photo.imageUrl, alt: `${title} photo`, orderId: photo.orderId,
          date: photo.orderId ? orderDates.get(photo.orderId) ?? null : null,
        })),
    }
  })
  if (garment.imageUrl && !sections[0].photos.some(photo => photo.src === garment.imageUrl)) {
    sections[0].photos.unshift({ id: `registration:${garment.id}`, src: garment.imageUrl, alt: 'Registration photo', orderId: null, date: null })
  }
  return sections.filter(section => section.photos.length > 0)
}

export function garmentPhotoPreview(garment: LaundryItemDto, album: ReturnType<typeof garmentAlbum>, photos: readonly LaundryItemPhotoDto[]): Array<{ id: string, src: string }> {
  const createdAt = new Map(photos.map(photo => [photo.id, photo.createdAt]))
  return album.flatMap(section => section.photos)
    .map(photo => ({ id: photo.id, src: photo.src, at: createdAt.get(photo.id) ?? garment.createdAt }))
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
    .map(({ id, src }) => ({ id, src }))
}
