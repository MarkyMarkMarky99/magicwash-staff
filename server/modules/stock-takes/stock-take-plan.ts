import { z } from 'zod'
import { normalizeSheetTimestamp } from '../../../shared/utils/bangkok-datetime.js'
import { jobTicketStatusSchema, type jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import type { StockTakeEntriesRow } from '../../sheets/StockTakeEntries/StockTakeEntries.repository.js'
import type { stockTakeScanSchema } from '../../../contracts/stock-takes/stock-take-api.schema.js'
import { serviceRoutes } from '../work-orders/job-ticket-provisioning.js'

type JobTicketRow = z.infer<typeof jobTicketsRowSchema>
export type Ticket = Partial<JobTicketRow> & Pick<JobTicketRow, 'id' | 'order_id' | 'scope'>

const baselineSchema = z.object({
  status: jobTicketStatusSchema,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  department: z.string(),
  task_code: z.string().nullable(),
  step_no: z.number().int().nonnegative(),
  notes: z.string().nullable(),
  scanned_by: z.string().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.string().nullable(),
}).strict()
const stamp = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
const patchSchema = z.object({
  status: z.enum(['In Progress', 'Completed']),
  started_at: stamp.optional(),
  completed_at: stamp.optional(),
  notes: z.string(),
  updated_at: stamp,
  updated_by: z.string().min(1),
}).strict()
type Patch = z.infer<typeof patchSchema>
type Baseline = z.infer<typeof baselineSchema>
type Step = { ticket: Ticket; status: Baseline['status'] }
export type Scan = z.infer<typeof stockTakeScanSchema>
export type RouteResult = { issue: 'zone_not_on_route' | 'multiple_tasks' | 'missing_route_step' | 'cancelled_step' | 'backward'; ticketIds: string[] }
  | { steps: Step[] }

export function inspectRoute(
  route: readonly Ticket[],
  serviceType: string | null,
  scan: Scan,
  pickedTicket: string | null,
  verifiedBag: boolean,
): RouteResult {
  const expected = serviceType && Object.hasOwn(serviceRoutes, serviceType)
    ? serviceRoutes[serviceType as keyof typeof serviceRoutes] : null
  const department = scan.status === 'Packed' ? 'Packaging' : scan.department
  const candidates = route.filter(ticket => ticket.department === department)
  if (!candidates.length && expected && !expected.some(step => step.department === department)) {
    return { issue: 'zone_not_on_route', ticketIds: [] }
  }
  let previousStep = -1
  const missingStep = !expected || expected.some(step => {
    const positions = route.filter(ticket => ticket.department === step.department && Number.isInteger(ticket.step_no))
      .map(ticket => ticket.step_no!).filter(position => position > previousStep)
    if (!positions.length) return true
    previousStep = Math.min(...positions)
    return false
  })
  if (missingStep
    || route.some(ticket => !baselineSchema.safeParse(baseline(ticket)).success)
    || new Set(route.map(ticket => ticket.id)).size !== route.length) {
    return { issue: 'missing_route_step', ticketIds: route.map(ticket => ticket.id) }
  }
  const target = candidates.length === 1 ? candidates[0] : candidates.find(ticket => ticket.id === pickedTicket)
  if (!target) return { issue: candidates.length ? 'multiple_tasks' : 'zone_not_on_route', ticketIds: candidates.map(ticket => ticket.id) }
  const status = scan.status === 'Packed' ? verifiedBag ? 'Completed' : target.status! : scan.status
  const earlier = route.filter(ticket => ticket.step_no! < target.step_no! && (scan.status !== 'Packed' || ticket.department !== 'Packaging'))
  const cancelled = earlier.find(ticket => ticket.status === 'Cancelled') ?? (target.status === 'Cancelled' ? target : undefined)
  if (cancelled) return { issue: 'cancelled_step', ticketIds: [cancelled.id] }
  const later = route.find(ticket => ticket.step_no! > target.step_no! && ['In Progress', 'Completed'].includes(ticket.status!))
  if (later || (target.status === 'Completed' && status !== 'Completed') || (status === 'Pending' && target.status === 'In Progress')) {
    return { issue: 'backward', ticketIds: [later?.id ?? target.id] }
  }
  return {
    steps: route.map(ticket => ({
      ticket,
      status: ticket === target ? status : earlier.includes(ticket) ? 'Completed' : ticket.status!,
    })),
  }
}

export function stockTakeTimestamp(value: unknown): string | null {
  // An unformatted Sheets datetime is a local calendar serial.
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400) * 1000)
    return date.toISOString().slice(0, 19).replace('T', ' ')
  }
  return normalizeSheetTimestamp(value) || null
}

function baseline(ticket: Ticket) {
  return {
    status: ticket.status,
    started_at: stockTakeTimestamp(ticket.started_at),
    completed_at: stockTakeTimestamp(ticket.completed_at),
    department: ticket.department,
    task_code: ticket.task_code ?? null,
    step_no: ticket.step_no,
    notes: ticket.notes == null || ticket.notes === '' ? null : String(ticket.notes),
    scanned_by: ticket.scanned_by == null || ticket.scanned_by === '' ? null : String(ticket.scanned_by),
    updated_at: stockTakeTimestamp(ticket.updated_at),
    updated_by: ticket.updated_by == null || ticket.updated_by === '' ? null : String(ticket.updated_by),
  }
}

export function buildTicketPlan(steps: readonly Step[], sessionId: string, actor: string, now: string) {
  return steps.map(({ ticket, status }) => {
    const before = baselineSchema.parse(baseline(ticket))
    const patch = status === before.status ? null : patchSchema.parse({
      status,
      ...(before.started_at ? {} : { started_at: now }),
      ...(status === 'Completed' && !before.completed_at ? { completed_at: now } : {}),
      notes: [before.notes, 'stock-take ' + sessionId].filter(Boolean).join('\n'),
      updated_at: now,
      updated_by: actor,
    })
    return { job_ticket_id: ticket.id, baseline: JSON.stringify(before), patch: patch && JSON.stringify(patch) }
  })
}

export type PlanRow = Partial<StockTakeEntriesRow> & Pick<StockTakeEntriesRow, 'id' | 'order_id' | 'laundry_item_id'>

function matches(actual: ReturnType<typeof baseline>, expected: Baseline): boolean {
  return (Object.keys(expected) as Array<keyof Baseline>).every(key => actual[key] === expected[key])
}

export function preflight(rows: readonly PlanRow[], route: readonly Ticket[]) {
  const tickets = new Map(route.map(ticket => [ticket.id, ticket]))
  const sameRoute = rows.length === route.length && tickets.size === route.length
    && new Set(rows.map(row => row.job_ticket_id)).size === rows.length
  let atBaseline = sameRoute
  let applied = sameRoute
  let hasWriteEvidence = false
  const updates: Array<{ keyValue: string; patch: Patch }> = []
  for (const row of rows) {
    const ticket = row.job_ticket_id && tickets.get(row.job_ticket_id)
    if (!ticket) {
      atBaseline = false
      applied = false
      continue
    }
    const before = baselineSchema.parse(JSON.parse(row.baseline ?? 'null'))
    const patch = row.patch ? patchSchema.parse(JSON.parse(row.patch)) : null
    const actual = baseline(ticket)
    if (!matches(actual, before)) atBaseline = false
    if (!matches(actual, { ...before, ...patch })) applied = false
    if (patch) {
      if (!(before.status === 'Pending' || (before.status === 'In Progress' && patch.status === 'Completed'))
        || (before.started_at && patch.started_at) || (before.completed_at && patch.completed_at)) {
        throw new Error('Stock-take plan contains an invalid ticket transition')
      }
      updates.push({ keyValue: ticket.id, patch })
      if (actual.updated_at === patch.updated_at && actual.notes === patch.notes) hasWriteEvidence = true
    }
  }
  if (applied) return { state: 'APPLIED' as const, updates: [], hasWriteEvidence }
  if (atBaseline) return { state: 'PLANNED' as const, updates, hasWriteEvidence }
  return { state: 'SKIPPED' as const, updates: [], hasWriteEvidence }
}
