import type { z } from 'zod'
import { jobTicketDepartmentSchema, jobTicketStatusSchema } from '@contracts/job-tickets/job-ticket-api.schema'
import type { JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { normalizeSheetDate } from '@/shared/utils/sheet-date'
import { normalizeGarmentTagId } from '@/shared/utils/garment-tag-id'
import type { JobTicketAdvanceResult } from '@/data/job-tickets/job-ticket.service'
import { departmentLabels } from './scan-result'

export type Department = Extract<z.infer<typeof jobTicketDepartmentSchema>, 'Washing' | 'DryCleaning' | 'Ironing' | 'Packaging'>
export type TicketStatus = z.infer<typeof jobTicketStatusSchema>
export type StatusFilter = 'ALL' | 'PENDING' | 'IN PROGRESS' | 'COMPLETED'
export type Grouper = 'item' | 'order'
export type AdvanceStatus = 'Pending' | 'In Progress'
export type ScanQueueEntry = { ticketId: string; orderId: string; tag: string }

export function statusForFilter(filter: StatusFilter): AdvanceStatus | null {
  return filter === 'PENDING' ? 'Pending' : filter === 'IN PROGRESS' ? 'In Progress' : null
}

export function toggleTicketSelection(selected: ReadonlySet<string>, ticket: JobTicketDto, status: AdvanceStatus | null): Set<string> {
  const next = new Set(selected)
  if (!status || !ticket.id || !ticket.laundryItemId || ticket.status !== status) return next
  if (next.has(ticket.id)) next.delete(ticket.id)
  else next.add(ticket.id)
  return next
}

export function resolveScanTag(value: string, tickets: readonly JobTicketDto[], status: AdvanceStatus, queue: readonly ScanQueueEntry[], department: Department): { entry?: ScanQueueEntry; message: string } {
  const tag = normalizeGarmentTagId(value)
  const matching = tickets.filter(ticket => ticket.id && ticket.department === department && ticket.laundryItemId === tag)
  const ticket = matching.find(row => row.status === status)
  if (!ticket) return { message: matching.length ? 'Not in this tab' : 'No job for this tag' }
  if (queue.some(entry => entry.ticketId === ticket.id)) return { message: 'Already queued' }
  return { entry: { ticketId: ticket.id, orderId: ticket.orderId, tag: tag! }, message: 'Queued' }
}

export function restoreScanQueue(value: unknown, tickets: readonly JobTicketDto[], status: AdvanceStatus, department: Department): ScanQueueEntry[] {
  if (!Array.isArray(value)) return []
  const valid = new Map(tickets.filter(ticket => ticket.id && ticket.status === status && ticket.department === department).map(ticket => [ticket.id, ticket]))
  const restored: ScanQueueEntry[] = []
  for (const entry of value) {
    if (restored.length >= 200) break
    if (!entry || typeof entry !== 'object' || typeof entry.ticketId !== 'string') continue
    const ticket = valid.get(entry.ticketId)
    if (ticket && ticket.laundryItemId && !restored.some(item => item.ticketId === ticket.id)) {
      restored.push({ ticketId: ticket.id, orderId: ticket.orderId, tag: ticket.laundryItemId })
    }
  }
  return restored
}

export function advanceSummary(result: Extract<JobTicketAdvanceResult, { kind: 'completed' }>, status: AdvanceStatus): string {
  const blockers = [...new Set(result.blocked.map(ticket => departmentLabels[ticket.blockedByDepartment]))]
  return [
    `${result.advanced.length} ${status === 'Pending' ? 'started' : 'completed'}`,
    `${result.blocked.length} blocked${blockers.length ? ` by ${blockers.join(', ')}` : ''}`,
    `${result.skipped.length} skipped`,
  ].join(' · ')
}

export interface OrderInfo {
  dueDate: string | null
  customerId: string | null
  customerName: string
  customerIndex: string | null
}

export interface DepartmentOrder extends OrderInfo {
  orderId: string
  tickets: JobTicketDto[]
  percentage: number
}

export const departments: Record<string, { code: Department; label: string }> = {
  washing: { code: 'Washing', label: 'Washing' },
  drycleaning: { code: 'DryCleaning', label: 'Dry Cleaning' },
  ironing: { code: 'Ironing', label: 'Ironing' },
  packaging: { code: 'Packaging', label: 'Packaging' },
}

export const statusFilters: readonly StatusFilter[] = ['ALL', 'PENDING', 'IN PROGRESS', 'COMPLETED']

export function readDepartment(value: unknown): { code: Department; label: string } | null {
  return typeof value === 'string' && Object.hasOwn(departments, value) ? departments[value]! : null
}

export function readStatusFilter(value: unknown): StatusFilter {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' && statusFilters.includes(raw as StatusFilter) ? raw as StatusFilter : 'ALL'
}

export function readGrouper(value: unknown): Grouper {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === 'item' ? 'item' : 'order'
}

export function filterTickets(tickets: readonly JobTicketDto[], filter: StatusFilter): JobTicketDto[] {
  return filter === 'ALL' ? [...tickets] : tickets.filter(ticket => ticket.status.toUpperCase() === filter)
}

export function countDepartmentStatuses(tickets: readonly JobTicketDto[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = { ALL: tickets.length, PENDING: 0, 'IN PROGRESS': 0, COMPLETED: 0 }
  for (const ticket of tickets) {
    const key = ticket.status.toUpperCase() as StatusFilter
    if (key !== 'ALL' && key in counts) counts[key] += 1
  }
  return counts
}

export function completionPercentage(tickets: readonly JobTicketDto[]): number {
  return tickets.length === 0 ? 0 : Math.round(100 * tickets.filter(ticket => ticket.status === 'Completed').length / tickets.length)
}

function dueSortKey(dueDate: string | null): string {
  return normalizeSheetDate(dueDate) ?? '9999-12-31'
}

export function sortDepartmentTickets(tickets: readonly JobTicketDto[], orderInfo: ReadonlyMap<string, OrderInfo>): JobTicketDto[] {
  return [...tickets].sort((left, right) =>
    Number(left.laundryItemId === null) - Number(right.laundryItemId === null)
    || dueSortKey(orderInfo.get(left.orderId)?.dueDate ?? null).localeCompare(dueSortKey(orderInfo.get(right.orderId)?.dueDate ?? null))
    || String(left.orderId ?? '').localeCompare(String(right.orderId ?? ''))
    || (left.laundryItemId ?? '').localeCompare(right.laundryItemId ?? ''))
}

export function groupDepartmentOrders(tickets: readonly JobTicketDto[], orderInfo: ReadonlyMap<string, OrderInfo>): DepartmentOrder[] {
  const groups = new Map<string, JobTicketDto[]>()
  for (const ticket of tickets) {
    const group = groups.get(ticket.orderId) ?? []
    group.push(ticket)
    groups.set(ticket.orderId, group)
  }
  return [...groups].map(([orderId, orderTickets]) => ({
    orderId,
    dueDate: orderInfo.get(orderId)?.dueDate ?? null,
    customerId: orderInfo.get(orderId)?.customerId ?? null,
    customerName: orderInfo.get(orderId)?.customerName ?? orderId,
    customerIndex: orderInfo.get(orderId)?.customerIndex ?? null,
    tickets: orderTickets,
    percentage: completionPercentage(orderTickets),
  })).sort((left, right) => dueSortKey(left.dueDate).localeCompare(dueSortKey(right.dueDate)) || String(left.orderId ?? '').localeCompare(String(right.orderId ?? '')))
}
