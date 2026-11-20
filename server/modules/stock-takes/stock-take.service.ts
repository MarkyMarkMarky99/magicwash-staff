import { createHash, randomUUID } from 'node:crypto'
import type { z } from 'zod'
import type { stockTakeResolutionEntrySchema } from '../../../contracts/stock-takes/stock-take-api.schema.js'
import { normalizeGarmentTagId } from '../../../shared/utils/garment-tag-id.js'
import { readScanCode } from '../../../shared/utils/scan-code.js'
import { getBagItemsRepository } from '../../sheets/BagItems/BagItems.repository.js'
import { getItemsRepository } from '../../sheets/Items/Items.repository.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import { getLaundryItemPhotosRepository } from '../../sheets/LaundryItemPhotos/LaundryItemPhotos.repository.js'
import { getLaundryItemsRepository } from '../../sheets/LaundryItems/LaundryItems.repository.js'
import { getLaundryPhotosRepository } from '../../sheets/LaundryPhotos/LaundryPhotos.repository.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import { getOrderGarmentsRepository } from '../../sheets/OrderGarments/OrderGarments.repository.js'
import { getOrderImagesRepository } from '../../sheets/OrderImages/OrderImages.repository.js'
import { getOrderItemFormsRepository } from '../../sheets/OrderItemForms/OrderItemForms.repository.js'
import { getStockTakeEntriesRepository, type StockTakeEntriesRow } from '../../sheets/StockTakeEntries/StockTakeEntries.repository.js'
import { getStockTakesRepository, type StockTakesRow } from '../../sheets/StockTakes/StockTakes.repository.js'
import { ApiError } from '../../shared/http/api-error.js'
import { readActiveStockTakes } from '../../shared/services/stock-take-freeze.js'
import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'
import { buildTicketPlan, preflight, stockTakeTimestamp, type PlanRow, type Scan, type Ticket } from './stock-take-plan.js'
import { computeStockTakeReport, entryScan, garmentKey, itemRoutes, scanKey, type Entry, type Inventory, type Session } from './stock-take-report.js'

type Resolution = z.infer<typeof stockTakeResolutionEntrySchema>
type StockTakeDependencies = {
  sessions: () => Pick<ReturnType<typeof getStockTakesRepository>, 'readFresh' | 'append' | 'update'>
  entries: () => Pick<ReturnType<typeof getStockTakeEntriesRepository>, 'readFresh' | 'batchAppend' | 'updateMany'>
  tickets: () => Pick<ReturnType<typeof getJobTicketsRepository>, 'readFresh' | 'updateMany'>
  inventory: (tickets: Ticket[]) => Promise<Inventory>
  now: () => Date
}

async function readInventory(tickets: Ticket[]): Promise<Inventory> {
  const [orders, orderGarments, photos, items, registrationPhotos, itemTypes, lines, bags, images] = await Promise.all([
    getOrderFormRepository().read(),
    getOrderGarmentsRepository().read(),
    getLaundryPhotosRepository().read(),
    getLaundryItemsRepository().read(),
    getLaundryItemPhotosRepository().read(),
    getItemsRepository().read(),
    getOrderItemFormsRepository().read(),
    getBagItemsRepository().read(),
    getOrderImagesRepository().read(),
  ])
  return { orders, orderGarments, photos, items, registrationPhotos, itemTypes, lines, bags, images, tickets }
}

function toSession(row: Partial<StockTakesRow>): Session {
  if (!row.id || !row.status || !row.opened_by || !row.opened_at) throw ApiError.internal('Stock-take session row is incomplete.')
  return {
    id: row.id, status: row.status, openedAt: stockTakeTimestamp(row.opened_at)!, openedBy: String(row.opened_by),
    closedAt: stockTakeTimestamp(row.closed_at), closedBy: row.closed_by ? String(row.closed_by) : null,
    appliedAt: stockTakeTimestamp(row.applied_at), appliedBy: row.applied_by ? String(row.applied_by) : null, notes: row.notes ? String(row.notes) : null,
  }
}

function entryBase(sessionId: string, actor: string, tag: string) {
  return {
    stock_take_id: sessionId, laundry_item_id: /^\d+$/.test(tag) ? "'" + tag : tag, created_by: actor,
    order_id: null, bag_id: null, department: null, status: null, resolution: null, reason: null,
    job_ticket_id: null, plan_state: null, baseline: null, patch: null, updated_at: null,
  } satisfies Partial<StockTakeEntriesRow>
}

function plansByGarment(entries: readonly Entry[], states: readonly StockTakeEntriesRow['plan_state'][]) {
  const plans = new Map<string, { orderId: string; tag: string; rows: PlanRow[] }>()
  for (const row of entries) {
    if (row.kind !== 'PLAN' || !states.includes(row.plan_state ?? null)) continue
    const tag = normalizeGarmentTagId(row.laundry_item_id)
    if (!row.id || !row.order_id || !tag) throw ApiError.internal('Stock-take plan row is incomplete.')
    const key = garmentKey(row.order_id, tag)
    const garment = plans.get(key) ?? { orderId: row.order_id, tag, rows: [] }
    garment.rows.push({ ...row, id: row.id, order_id: row.order_id, laundry_item_id: tag })
    plans.set(key, garment)
  }
  return plans
}

export class StockTakeService {
  private readonly deps: StockTakeDependencies

  constructor(deps: Partial<StockTakeDependencies> = {}) {
    this.deps = {
      sessions: getStockTakesRepository, entries: getStockTakeEntriesRepository, tickets: getJobTicketsRepository,
      inventory: readInventory, now: () => new Date(), ...deps,
    }
  }

  private async readSession(id: string) {
    const rows = (await this.deps.sessions().readFresh()).filter(row => row.id === id)
    if (!rows.length) throw ApiError.notFound('Stock-take session not found.')
    if (rows.length !== 1) throw ApiError.conflict('Stock-take session ID has duplicate rows.')
    return toSession(rows[0]!)
  }

  private async requireActive(id: string, status?: 'OPEN' | 'CLOSED') {
    const active = await this.active()
    if (!active || active.id !== id || (status && active.status !== status)) {
      throw ApiError.conflict('The requested stock-take is not in the required active state.')
    }
    return active
  }

  private async entries(id: string) {
    return (await this.deps.entries().readFresh()).filter(row => row.stock_take_id === id)
  }

  private async tickets(): Promise<Ticket[]> {
    const rows = await this.deps.tickets().readFresh()
    return rows.flatMap(row => row.id && row.order_id && row.scope
      ? [{ ...row, id: row.id, order_id: row.order_id, scope: row.scope }] : [])
  }

  private async inventory() {
    return this.deps.inventory(await this.tickets())
  }

  async active() {
    const rows = await readActiveStockTakes(this.deps.sessions())
    if (rows.length > 1) throw ApiError.conflict('Multiple active stock-takes require review.')
    return rows[0] ? toSession(rows[0]) : null
  }

  async open(notes: string | null, actor: string) {
    if (await this.active()) throw ApiError.conflict('A stock-take is already active.')
    return toSession(await this.deps.sessions().append({
      id: 'ST-' + randomUUID(), status: 'OPEN', opened_by: actor, notes: notes && "'" + notes,
      closed_at: null, closed_by: null, applied_at: null, applied_by: null,
    }))
  }

  async scans(sessionId: string, scans: readonly Scan[], actor: string) {
    await this.requireActive(sessionId, 'OPEN')
    const repository = this.deps.entries()
    const stored = await this.entries(sessionId)
    const known = new Set(stored.flatMap(row => {
      const scan = entryScan(row)
      return scan ? [scanKey(scan)] : []
    }))
    const normalized = scans.map(scan => {
      const code = readScanCode(scan.tag)
      const tag = normalizeGarmentTagId(code.id)
      if (!tag || !/^[0-9A-Za-z]{8}$/.test(tag) || (code.kind !== 'garment' && code.kind !== 'unknown')) {
        throw ApiError.badRequest('A scan must contain an eight-character garment tag.')
      }
      return { ...scan, tag }
    })
    const missing = normalized.flatMap(scan => {
      const key = scanKey(scan)
      if (known.has(key)) return []
      known.add(key)
      const id = 'SCAN-' + createHash('sha256').update(JSON.stringify([sessionId, key])).digest('hex')
      return [{
        ...entryBase(sessionId, actor, scan.tag), id, kind: 'SCAN' as const,
        bag_id: scan.bagId && "'" + scan.bagId, department: scan.department, status: scan.status,
      }]
    })
    if (missing.length) await repository.batchAppend(missing)
    return { scans: normalized, added: missing.length }
  }

  async close(id: string, actor: string) {
    const active = await this.requireActive(id)
    if (active.status === 'CLOSED') return active
    await this.deps.sessions().update(id, {
      status: 'CLOSED', closed_by: actor, closed_at: formatBangkokTimestamp(this.deps.now()),
    })
    return this.readSession(id)
  }

  async cancel(id: string, actor: string) {
    await this.requireActive(id)
    const entries = await this.entries(id)
    if (plansByGarment(entries, ['APPLIED']).size) throw ApiError.conflict('Finish the stock-take after applying corrections.')
    await this.requireNoUnrecordedWrite(entries, ['PLANNED', 'SKIPPED', 'SUPERSEDED'])
    await this.deps.sessions().update(id, {
      status: 'CANCELLED', applied_by: actor, applied_at: formatBangkokTimestamp(this.deps.now()),
    })
    return this.readSession(id)
  }

  async report(id: string) {
    const [session, entries, inventory] = await Promise.all([this.readSession(id), this.entries(id), this.inventory()])
    return computeStockTakeReport(session, inventory, entries).report
  }

  async resolutions(id: string, resolutions: readonly Resolution[], actor: string) {
    const session = await this.requireActive(id, 'CLOSED')
    const [entries, inventory] = await Promise.all([this.entries(id), this.inventory()])
    const { report } = computeStockTakeReport(session, inventory, entries)
    const keys = new Set(report.orders.flatMap(order => order.garments.map(garment => garmentKey(order.orderId, garment.tag))))
    const gaps = new Set(report.membershipGaps.flatMap(gap => gap.tag ? [garmentKey(gap.orderId, gap.tag)] : []))
    const routes = itemRoutes(inventory.tickets)
    for (const resolution of resolutions) {
      const key = garmentKey(resolution.orderId, resolution.tag)
      if (!keys.has(key) && !(resolution.resolution === 'LINK_CONFIRMED' && gaps.has(key))) {
        throw ApiError.badRequest('Resolution must refer to an open order garment or membership gap.')
      }
      if (resolution.resolution === 'TASK_PICK' && !routes.get(key)?.some(ticket => ticket.id === resolution.jobTicketId)) {
        throw ApiError.badRequest('The selected ticket is not a live item ticket for this garment.')
      }
    }
    const tags = new Set(resolutions.map(row => row.tag))
    const membershipTags = new Set(resolutions.filter(row => row.resolution === 'LINK_CONFIRMED').map(row => row.tag))
    if ([...plansByGarment(entries, ['APPLIED']).values()].some(plan => membershipTags.has(plan.tag))) {
      throw ApiError.conflict('Ownership cannot change after corrections for this tag were applied.')
    }
    const affected = entries.flatMap(row => row.kind === 'PLAN' && row.plan_state === 'PLANNED'
      && row.id && tags.has(normalizeGarmentTagId(row.laundry_item_id) ?? '') ? [row.id] : [])
    if (affected.length) {
      await this.requireNoUnrecordedWrite(entries)
      await this.deps.entries().updateMany(affected.map(keyValue => ({ keyValue, patch: { plan_state: 'SUPERSEDED' } })))
    }
    await this.deps.entries().batchAppend(resolutions.map(resolution => ({
      ...entryBase(id, actor, resolution.tag), id: 'RES-' + randomUUID(), kind: 'RESOLUTION',
      order_id: resolution.orderId, resolution: resolution.resolution, reason: resolution.reason ? "'" + resolution.reason : null,
      job_ticket_id: resolution.jobTicketId ?? null,
    })))
    return { recorded: resolutions.length }
  }

  private async requireNoUnrecordedWrite(
    entries: readonly Entry[],
    states: readonly StockTakeEntriesRow['plan_state'][] = ['PLANNED'],
  ) {
    const plans = plansByGarment(entries, states)
    if (![...plans.values()].some(plan => plan.rows.some(row => row.patch))) return
    const routes = itemRoutes(await this.tickets())
    for (const [key, plan] of plans) {
      const check = preflight(plan.rows, routes.get(key) ?? [])
      if (check.hasWriteEvidence) {
        throw ApiError.conflict('Retry Apply to verify pending corrections, or use Finish if none remain.')
      }
    }
  }

  async preview(id: string, actor: string) {
    const session = await this.requireActive(id, 'CLOSED')
    const [entries, inventory] = await Promise.all([this.entries(id), this.inventory()])
    await this.requireNoUnrecordedWrite(entries)
    const appliedTags = new Set([...plansByGarment(entries, ['APPLIED']).values()].map(plan => plan.tag))
    const prior = plansByGarment(entries, ['PLANNED', 'SKIPPED'])
    const { plans } = computeStockTakeReport(session, inventory, entries)
    const timestamp = formatBangkokTimestamp(this.deps.now())
    const rows: Array<Partial<StockTakeEntriesRow>> = []
    const planned = plans.flatMap(({ orderId, tag, steps }) => {
      if (appliedTags.has(tag)) return []
      const tickets = buildTicketPlan(steps, id, actor, timestamp)
      rows.push(...tickets.map(ticket => ({
        ...entryBase(id, actor, tag), ...ticket, id: 'PLAN-' + randomUUID(), kind: 'PLAN' as const,
        order_id: orderId, plan_state: 'PLANNED' as const,
      })))
      return [{ orderId, tag, ticketCount: tickets.length, changeCount: tickets.filter(ticket => ticket.patch).length }]
    })
    const repository = this.deps.entries()
    const replaced = new Set(planned.map(row => garmentKey(row.orderId, row.tag)))
    // Retire pending rows even if a new resolution or conflict makes the garment ineligible.
    const retire = [...prior.entries()].flatMap(([key, plan]) =>
      plan.rows.filter(row => row.plan_state === 'PLANNED' || replaced.has(key)))
    if (retire.length) await repository.updateMany(retire.map(row => ({ keyValue: row.id, patch: { plan_state: 'SUPERSEDED' } })))
    if (rows.length) await repository.batchAppend(rows)
    const report = computeStockTakeReport(session, inventory, await this.entries(id)).report
    return { report, planned }
  }

  async apply(id: string) {
    await this.requireActive(id, 'CLOSED')
    const plans = plansByGarment(await this.entries(id), ['PLANNED'])
    const result: { applied: Array<{ orderId: string; tag: string }>; skipped: Array<{ orderId: string; tag: string }> } = { applied: [], skipped: [] }
    if (!plans.size) return result
    const routes = itemRoutes(await this.tickets())
    const checks = [...plans.entries()].map(([key, plan]) => ({ key, ...plan, ...preflight(plan.rows, routes.get(key) ?? []) }))
    const updates = checks.flatMap(check => check.updates).map(update => ({
      ...update, patch: { ...update.patch, notes: "'" + update.patch.notes },
    }))
    if (updates.length) await this.deps.tickets().updateMany(updates)
    const after = updates.length ? itemRoutes(await this.tickets()) : routes
    const states = checks.flatMap(({ key, orderId, tag, state, rows }) => {
      if (state !== 'SKIPPED' && preflight(rows, after.get(key) ?? []).state !== 'APPLIED') {
        throw ApiError.internal('Stock-take corrections could not be verified. Retry Apply.')
      }
      const plan_state: StockTakeEntriesRow['plan_state'] = state === 'SKIPPED' ? 'SKIPPED' : 'APPLIED'
      result[plan_state === 'APPLIED' ? 'applied' : 'skipped'].push({ orderId, tag })
      return rows.map(row => ({ keyValue: row.id, patch: { plan_state } }))
    })
    await this.deps.entries().updateMany(states)
    return result
  }

  async finish(id: string, actor: string) {
    const stored = await this.readSession(id)
    if (stored.status === 'APPLIED') return stored
    if (stored.status === 'OPEN') await this.close(id, actor)
    await this.requireActive(id, 'CLOSED')
    await this.apply(id)
    await this.preview(id, actor)
    await this.apply(id)
    await this.deps.sessions().update(id, {
      status: 'APPLIED', applied_by: actor, applied_at: formatBangkokTimestamp(this.deps.now()),
    })
    return this.readSession(id)
  }
}
