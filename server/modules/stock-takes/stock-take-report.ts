import type { z } from 'zod'
import type { stockTakeReportSchema, stockTakeSessionSchema } from '../../../contracts/stock-takes/stock-take-api.schema.js'
import { normalizeGarmentTagId } from '../../../shared/utils/garment-tag-id.js'
import type { StockTakeEntriesRow } from '../../sheets/StockTakeEntries/StockTakeEntries.repository.js'
import { inspectRoute, type Scan, type Ticket } from './stock-take-plan.js'

export type Entry = Partial<StockTakeEntriesRow>
export type Session = z.infer<typeof stockTakeSessionSchema>
type Report = z.infer<typeof stockTakeReportSchema>
type Garment = Report['missing'][number]
type Issue = Report['blocked'][number]
type SourceLink = { order_id?: string | null; orderitem_id?: string | null; deleted_at?: string | null }
export type Inventory = {
  orders: ReadonlyArray<{ id?: string; status?: string | null; service_type?: string | null }>
  orderGarments: ReadonlyArray<SourceLink & { laundry_item_id?: unknown }>
  photos: ReadonlyArray<SourceLink & { item_id?: unknown; is_active?: boolean | null; image_url?: string | null }>
  items: ReadonlyArray<{ id?: unknown; deleted_at?: string | null; item_id?: string | null; image_url?: string | null }>
  registrationPhotos: ReadonlyArray<{ laundry_item_id?: unknown; photo_type?: string; deleted_at?: string | null; image_url?: string }>
  itemTypes: ReadonlyArray<{ id?: string; display_name_th?: string; display_name_en?: string | null }>
  lines: ReadonlyArray<{ id?: string; order_id?: string | null; service_type?: string | null }>
  bags: ReadonlyArray<{ order_id?: string; laundry_item_id?: unknown; bag_id?: string }>
  images: ReadonlyArray<{ id?: string; order_id?: string; image_path?: string | null }>
  tickets: readonly Ticket[]
}

export const garmentKey = (orderId: string, tag: string) => JSON.stringify([orderId, tag])
export const scanKey = (scan: Scan) => JSON.stringify([scan.tag, scan.department, scan.status, scan.bagId])

export function entryScan(entry: Entry): Scan | null {
  const tag = normalizeGarmentTagId(entry.laundry_item_id)
  if (entry.kind !== 'SCAN' || !tag || !entry.status) return null
  return { tag, department: entry.department ?? null, status: entry.status, bagId: entry.bag_id ?? null }
}

export function itemRoutes(tickets: readonly Ticket[]): Map<string, Ticket[]> {
  const routes = new Map<string, Ticket[]>()
  for (const ticket of tickets) {
    const tag = normalizeGarmentTagId(ticket.laundry_item_id)
    if (ticket.deleted_at || ticket.scope !== 'ITEM' || !tag) continue
    const key = garmentKey(ticket.order_id, tag)
    const route = routes.get(key) ?? []
    route.push(ticket)
    routes.set(key, route)
  }
  for (const route of routes.values()) route.sort((a, b) => (a.step_no ?? 0) - (b.step_no ?? 0))
  return routes
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string | null | undefined): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const value = key(row)
    if (!value) continue
    const group = groups.get(value) ?? []
    group.push(row)
    groups.set(value, group)
  }
  return groups
}

export function computeStockTakeReport(session: Session, inventory: Inventory, entries: readonly Entry[]) {
  const report: Report = {
    session, orders: [], missing: [], conflicts: [], unexpected: [], backward: [], blocked: [],
    packingExceptions: [], dispatchExceptions: [], membershipGaps: [], skipped: [],
  }
  const plans: Array<{ orderId: string; tag: string; steps: Extract<ReturnType<typeof inspectRoute>, { steps: unknown }>['steps'] }> = []
  const orders = inventory.orders.filter(order => order.id && !['COMPLETED', 'CANCELLED'].includes(order.status ?? ''))
  const items = groupBy(inventory.items.filter(item => !item.deleted_at), row => normalizeGarmentTagId(row.id))
  const registrationPhotos = groupBy(inventory.registrationPhotos.filter(photo => !photo.deleted_at && photo.photo_type === 'REGISTRATION'), row => normalizeGarmentTagId(row.laundry_item_id))
  const itemTypes = new Map(inventory.itemTypes.map(item => [item.id, item.display_name_th ?? item.display_name_en]))
  const photos = groupBy(inventory.photos.filter(photo => !photo.deleted_at && photo.is_active !== false), row => row.order_id)
  const links = groupBy(inventory.orderGarments.filter(link => !link.deleted_at), row => row.order_id)
  const routes = itemRoutes(inventory.tickets)
  const itemTicketsByOrder = groupBy(inventory.tickets.filter(ticket => ticket.scope === 'ITEM' && !ticket.deleted_at), row => row.order_id)
  const logistics = groupBy(inventory.tickets.filter(ticket => ticket.scope === 'ORDER' && ticket.task_code === 'LOG-BAG' && !ticket.deleted_at), row => row.id)
  const images = groupBy(inventory.images, row => row.id)
  const bags = groupBy(inventory.bags, row => {
    const tag = normalizeGarmentTagId(row.laundry_item_id)
    return row.order_id && tag ? garmentKey(row.order_id, tag) : null
  })
  const lines = groupBy(inventory.lines, row => row.id)
  const scans = new Map<string, Scan>()
  const dispositions = new Map<string, Entry>()
  const confirmations = new Set<string>()
  const owners = new Map<string, string>()
  const taskPicks = new Map<string, string>()
  const skipped = new Map<string, Report['skipped'][number]>()
  for (const entry of entries) {
    const scan = entryScan(entry)
    if (scan) scans.set(scanKey(scan), scan)
    const tag = normalizeGarmentTagId(entry.laundry_item_id)
    const orderId = entry.order_id
    if (!tag || !orderId) continue
    const key = garmentKey(orderId, tag)
    if (entry.kind === 'PLAN' && entry.plan_state === 'SKIPPED') skipped.set(key, { orderId, tag })
    if (entry.kind !== 'RESOLUTION') continue
    if (entry.resolution === 'LINK_CONFIRMED') {
      confirmations.add(key)
      owners.set(tag, orderId)
    } else if (entry.resolution === 'TASK_PICK' && entry.job_ticket_id) {
      taskPicks.set(key, entry.job_ticket_id)
    } else {
      dispositions.set(key, entry)
    }
  }
  report.skipped = [...skipped.values()]
  const observed = groupBy([...scans.values()], scan => scan.tag)
  const claims = new Map<string, Set<string>>()
  const orderInputs = orders.map(order => {
    const orderId = order.id!
    const garmentLinks = groupBy(links.get(orderId) ?? [], row => normalizeGarmentTagId(row.laundry_item_id))
    const photoLinks = groupBy(photos.get(orderId) ?? [], row => normalizeGarmentTagId(row.item_id))
    const linkedTags = new Set([...garmentLinks.keys(), ...photoLinks.keys()])
    const ticketTags = new Set((itemTicketsByOrder.get(orderId) ?? [])
      .map(row => normalizeGarmentTagId(row.laundry_item_id)).filter((tag): tag is string => !!tag))
    for (const tag of new Set([...linkedTags, ...ticketTags])) {
      const claimants = claims.get(tag) ?? new Set()
      claimants.add(orderId)
      claims.set(tag, claimants)
    }
    return { order, orderId, garmentLinks, photoLinks, linkedTags, ticketTags }
  })
  const closedIds = new Set(inventory.orders.filter(order => ['COMPLETED', 'CANCELLED'].includes(order.status ?? '')).map(order => order.id))
  const closedTags = new Set([
    ...inventory.orderGarments.filter(link => !link.deleted_at && closedIds.has(link.order_id ?? undefined)).map(row => normalizeGarmentTagId(row.laundry_item_id)),
    ...inventory.photos.filter(link => !link.deleted_at && link.is_active !== false && closedIds.has(link.order_id ?? undefined)).map(row => normalizeGarmentTagId(row.item_id)),
    ...inventory.tickets.filter(ticket => !ticket.deleted_at && ticket.scope === 'ITEM' && closedIds.has(ticket.order_id)).map(row => normalizeGarmentTagId(row.laundry_item_id)),
  ])
  for (const [tag, observations] of observed) {
    if (!claims.has(tag)) {
      report.unexpected.push({ tag, code: closedTags.has(tag) ? 'closed_order_only' : items.has(tag) ? 'no_open_order' : 'unregistered_tag' })
    }
    if (new Set(observations.map(scan => JSON.stringify([scan.department, scan.status]))).size > 1) {
      report.conflicts.push({ tag, orderId: null, code: 'multiple_zones', ticketIds: [] })
    }
    if (new Set(observations.flatMap(scan => scan.status === 'Packed' && scan.bagId ? [scan.bagId] : [])).size > 1) {
      report.conflicts.push({ tag, orderId: null, code: 'multiple_bags', ticketIds: [] })
    }
  }

  for (const { order, orderId, garmentLinks, photoLinks, linkedTags, ticketTags } of orderInputs) {
    if (!linkedTags.size && !links.get(orderId)?.length && !itemTicketsByOrder.get(orderId)?.length) continue
    const result: Report['orders'][number] = {
      orderId, status: order.status ?? null, found: 0, returned: 0, offSite: 0, expected: 0, accounted: false, garments: [],
    }
    let review = false
    const gap = (tag: string | null, code: string, confirmed = false) => {
      report.membershipGaps.push({ orderId, tag, code, confirmed })
      if (!confirmed) review = true
    }
    if (links.get(orderId)?.some(link => !normalizeGarmentTagId(link.laundry_item_id))) gap(null, 'link_without_tag')
    if (itemTicketsByOrder.get(orderId)?.some(ticket => !normalizeGarmentTagId(ticket.laundry_item_id))) gap(null, 'ticket_without_tag')
    for (const tag of new Set([...linkedTags, ...ticketTags])) {
      const key = garmentKey(orderId, tag)
      const confirmed = confirmations.has(key)
      if (!linkedTags.has(tag)) gap(tag, 'ticket_without_link', confirmed)
      else if (garmentLinks.size && photoLinks.size && (!garmentLinks.has(tag) || !photoLinks.has(tag))) {
        gap(tag, 'one_membership_source', confirmed)
      }
      const registrations = items.get(tag) ?? []
      const legacyPhotos = photoLinks.get(tag) ?? []
      if (registrations.length > 1 || (!registrations.length && !legacyPhotos.length)) {
        gap(tag, registrations.length ? 'duplicate_registration' : 'missing_registration')
        continue
      }
      if (!linkedTags.has(tag) && !confirmed) continue
      const item = registrations[0]
      const claimants = claims.get(tag)!
      const owner = owners.get(tag)
      const sharedTag = claimants.size > 1
      const canUseScan = !sharedTag || owner === orderId
      if (sharedTag && !canUseScan) {
        report.conflicts.push({ orderId, tag, code: 'multiple_order_claims', ticketIds: [] })
        review = true
      }
      const route = routes.get(key) ?? []
      const observations = canUseScan ? observed.get(tag) ?? [] : []
      const bagLinks = bags.get(key) ?? []
      const hint = (bagId: string) => logistics.get('LOG-' + orderId + '-' + bagId + '-LOG-BAG') ?? []
      const resolution = dispositions.get(key)
      const disposition = observations.length ? 'FOUND'
        : resolution?.reason && resolution.resolution === 'RETURNED' ? 'RETURNED'
        : resolution?.reason && resolution.resolution === 'OFF_SITE' ? 'OFF_SITE' : 'MISSING'
      const last = [...route].reverse().find(ticket => ticket.status === 'In Progress' || ticket.status === 'Completed') ?? route[0]
      const garment: Garment = {
        orderId, tag, disposition, garmentType: item ? itemTypes.get(item.item_id ?? '') ?? item.item_id ?? null : null,
        registrationPhoto: item?.image_url || registrationPhotos.get(tag)?.[0]?.image_url
          || legacyPhotos.find(photo => photo.image_url)?.image_url || null,
        lastTicket: last?.department && last.status && typeof last.step_no === 'number'
          ? { id: last.id, department: last.department, status: last.status, stepNo: last.step_no, taskCode: last.task_code ?? null } : null,
        logistics: [...new Set(bagLinks.flatMap(bag => bag.bag_id ? [bag.bag_id] : []))]
          .map(bagId => ({ bagId, status: hint(bagId)[0]?.status ?? null })),
        resolution: resolution?.resolution ?? null, reason: resolution?.reason ?? null,
      }
      result.garments.push(garment)
      result.expected++
      if (disposition === 'FOUND') result.found++
      else if (disposition === 'RETURNED') result.returned++
      else if (disposition === 'OFF_SITE') result.offSite++
      else report.missing.push(garment)

      let verifiedBag = false
      for (const scan of observations) {
        if (scan.status !== 'Packed') continue
        const bagId = scan.bagId
        const log = bagId ? hint(bagId) : []
        const bagImage = bagId && images.get(bagId)?.filter(image => image.order_id === orderId && !!image.image_path)
        const issue = (code: string): Issue => ({ orderId, tag, code, ticketIds: log.map(ticket => ticket.id) })
        if (log.some(ticket => ticket.status === 'In Progress' || ticket.status === 'Completed')) {
          report.dispatchExceptions.push(issue('dispatch_already_started'))
        }
        const code = !bagId ? 'unreadable_bag' : bagLinks.length !== 1 ? 'bag_link_count'
          : bagLinks[0]!.bag_id !== bagId ? 'mismatched_bag'
          : !bagImage || bagImage.length !== 1 ? 'missing_bag_image'
          : log.length !== 1 || log[0]!.order_id !== orderId || log[0]!.status !== 'Pending' ? 'unverified_logistics' : null
        if (code) report.packingExceptions.push(issue(code))
        else verifiedBag = true
      }
      const zones = new Map(observations.map(scan => [JSON.stringify([scan.department, scan.status]), scan]))
      const observedBags = new Set(observations.flatMap(scan => scan.bagId ? [scan.bagId] : []))
      if (zones.size > 1 || observedBags.size > 1) {
        review = true
        continue
      }
      const scan = observations.find(entry => entry.bagId) ?? observations[0]
      if (!scan) continue
      const sourceLinks = garmentLinks.get(tag) ?? photoLinks.get(tag) ?? []
      const types = new Set(sourceLinks.map(link => {
        const line = link.orderitem_id && lines.get(link.orderitem_id)?.find(row => row.order_id === orderId)
        return line ? line.service_type ?? null : order.service_type ?? null
      }))
      const serviceType = types.size === 1 ? [...types][0]! : types.size === 0 ? order.service_type ?? null : null
      const inspected = inspectRoute(route, serviceType, scan, taskPicks.get(key) ?? null, verifiedBag)
      if ('steps' in inspected) {
        if (confirmed || (linkedTags.has(tag) && (!garmentLinks.size || !photoLinks.size || garmentLinks.has(tag) && photoLinks.has(tag)))) {
          plans.push({ orderId, tag, steps: inspected.steps })
        }
      } else {
        const issue = { orderId, tag, code: inspected.issue, ticketIds: inspected.ticketIds }
        if (inspected.issue === 'backward') report.backward.push(issue)
        else if (inspected.issue === 'cancelled_step' || inspected.issue === 'missing_route_step') report.blocked.push(issue)
        else {
          report.conflicts.push(issue)
          review = true
        }
      }
    }
    if (!result.expected) gap(null, 'empty_order')
    result.accounted = !review && result.expected === result.found + result.returned + result.offSite
    report.orders.push(result)
  }
  return { report, plans }
}
