import { listJobTickets, type JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { listBagItems, type BagItemDto } from '@/data/bag-items/bag-item.service'
import { listOrderImages, type OrderImageDto } from '@/data/order-images/order-image.service'
import { listLaundryPhotosByTag } from '@/data/laundry-photos/laundry-photo.service'
import { getWorkOrder } from '@/data/work-orders/work-order.service'
import { useCustomerStore } from '@/data/customers/customer.store'
import { findEarlierJobTicket } from '@shared/utils/job-ticket-gating'
import { normalizeSheetTimestamp } from '@shared/utils/bangkok-datetime'
import type { PackagingOrder } from './packaging-bags'

async function allPages<T>(fetchPage: (page: number) => Promise<{ items: T[] }>): Promise<T[]> {
  const rows: T[] = []
  for (let page = 1; ; page += 1) {
    const { items } = await fetchPage(page)
    rows.push(...items)
    if (items.length < 500) return rows
  }
}

export async function loadPackagingOrder(orderId: string): Promise<PackagingOrder> {
  const [header, jobs, items, images, photos] = await Promise.all([
    getWorkOrder(orderId),
    allPages<JobTicketDto>(page => listJobTickets({ orderId, page, perPage: 500 })),
    allPages<BagItemDto>(page => listBagItems(orderId, page)),
    allPages<OrderImageDto>(page => listOrderImages(orderId, page)),
    listLaundryPhotosByTag(orderId),
  ])
  const customer = useCustomerStore().customers.find(row => row.customerId === header.customerId)
  const tickets = jobs.filter(ticket => ticket.orderId === orderId && !ticket.deletedAt)
  const packaging = tickets.filter(ticket => ticket.department === 'Packaging' && ticket.scope === 'ITEM' && ticket.laundryItemId)
  const confirmedBagIds = new Map(items.map(item => [item.laundryItemId, item.bagId]))
  const bagPhotos = new Map(images.map(image => [image.orderImageId, image.imagePath]))
  const times = new Map<string, string>()
  for (const item of items) {
    const time = normalizeSheetTimestamp(item.createdAt)
    if (!times.has(item.bagId) || time < times.get(item.bagId)!) times.set(item.bagId, time)
  }
  return {
    orderId,
    customerName: customer?.customerName ?? header.customerId,
    customerIndex: String(customer?.customerIndex ?? '—'),
    statusLabel: header.status ? header.status.charAt(0) + header.status.slice(1).toLowerCase() : 'Unknown',
    garments: [...new Set(packaging.map(ticket => ticket.laundryItemId!))].map(tagId => {
      const blocker = packaging.filter(ticket => ticket.laundryItemId === tagId)
        .map(ticket => findEarlierJobTicket(ticket, tickets)).find(ticket => ticket !== undefined)
      return { tagId, imageUrl: photos.get(tagId) ?? null, waitingFor: blocker?.department ?? null,
        confirmedBagId: confirmedBagIds.get(tagId) ?? null }
    }),
    confirmedBags: [...times].map(([id, confirmedAt]) => ({ id, confirmedAt, photoUrl: bagPhotos.get(id) ?? null }))
      .sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt) || a.id.localeCompare(b.id)),
  }
}
