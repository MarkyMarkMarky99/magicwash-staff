import type { JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { useJobTicketStore } from '@/data/job-tickets/job-ticket.store'
import { listBagItems, type BagItemDto } from '@/data/bag-items/bag-item.service'
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

export async function loadPackagingOrder(orderId: string, onPreview?: (order: PackagingOrder, rebuild: () => PackagingOrder) => void): Promise<PackagingOrder> {
  const store = useJobTicketStore()
  let items: BagItemDto[] = []
  const rebuild = () => buildPackagingOrder(orderId, store.orderTickets(orderId), items)
  if (store.orderTickets(orderId, 'Packaging').length) onPreview?.(rebuild(), rebuild)
  await Promise.all([
    store.loadOrder(orderId),
    allPages<BagItemDto>(page => listBagItems(orderId, page)).then(bagItems => {
      items = bagItems
      if (store.orderTickets(orderId, 'Packaging').length) onPreview?.(rebuild(), rebuild)
    }),
  ])
  onPreview?.(rebuild(), rebuild)
  return rebuild()
}

function buildPackagingOrder(orderId: string, jobs: JobTicketDto[], items: BagItemDto[]): PackagingOrder {
  const tickets = jobs.filter(ticket => ticket.orderId === orderId && !ticket.deletedAt)
  const customerId = tickets.find(ticket => ticket.customerId)?.customerId ?? ''
  const customer = useCustomerStore().customers.find(row => row.customerId === customerId)
  const packaging = tickets.filter(ticket => ticket.department === 'Packaging' && ticket.scope === 'ITEM' && ticket.laundryItemId)
  const confirmedBagIds = new Map(items.map(item => [item.laundryItemId, item.bagId]))
  const bagPhotos = new Map(tickets.filter(ticket => ticket.department === 'Logistics').map(ticket => [ticket.id, ticket.photoEvidenceUrl]))
  const times = new Map<string, string>()
  for (const item of items) {
    const time = normalizeSheetTimestamp(item.createdAt)
    if (!times.has(item.bagId) || time < times.get(item.bagId)!) times.set(item.bagId, time)
  }
  return {
    orderId,
    customerName: customer?.customerName ?? customerId,
    customerIndex: String(customer?.customerIndex ?? '—'),
    garments: [...new Set(packaging.map(ticket => ticket.laundryItemId!))].sort((a, b) => a.localeCompare(b)).map(tagId => {
      const blocker = packaging.filter(ticket => ticket.laundryItemId === tagId)
        .map(ticket => findEarlierJobTicket(ticket, tickets)).find(ticket => ticket !== undefined)
      const imageUrl = packaging.find(ticket => ticket.laundryItemId === tagId && ticket.photoEvidenceUrl)?.photoEvidenceUrl ?? null
      return { tagId, imageUrl, waitingFor: blocker?.department ?? null,
        confirmedBagId: confirmedBagIds.get(tagId) ?? null }
    }),
    confirmedBags: [...times].map(([id, confirmedAt]) => ({ id, confirmedAt, photoUrl: bagPhotos.get(`LOG-${orderId}-${id}-LOG-BAG`) ?? null }))
      .sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt) || a.id.localeCompare(b.id)),
  }
}
